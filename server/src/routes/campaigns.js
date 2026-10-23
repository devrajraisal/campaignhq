import { Router } from 'express';
import { db, logActivity } from '../db.js';
import { requireAuth, requireWorkspace, requireCampaign } from '../middleware/auth.js';
import { computeKpis, sumMetrics, parseCsv } from '../utils/kpi.js';

const router = Router();
router.use(requireAuth);

const CHANNELS = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads', 'Email', 'Other'];
const STATUSES = ['draft', 'active', 'paused', 'completed'];

function campaignWithKpis(campaign) {
  const rows = db.prepare('SELECT * FROM metrics WHERE campaign_id = ?').all(campaign.id);
  return { ...campaign, kpis: computeKpis(sumMetrics(rows)), metricsCount: rows.length };
}

// ---- Campaigns ------------------------------------------------------------

router.get('/workspaces/:workspaceId/campaigns', requireWorkspace(), (req, res) => {
  const { status, channel, search, sort = 'created_at', order = 'desc', page = 1, pageSize = 20 } = req.query;
  let rows = db.prepare('SELECT * FROM campaigns WHERE workspace_id = ?').all(req.workspace.id);
  if (status) rows = rows.filter((r) => r.status === status);
  if (channel) rows = rows.filter((r) => r.channel === channel);
  if (search) rows = rows.filter((r) => r.name.toLowerCase().includes(String(search).toLowerCase()));
  rows = rows.map(campaignWithKpis);
  const sortKeys = { created_at: 'created_at', name: 'name', budget: 'budget', spend: null, roas: null };
  rows.sort((a, b) => {
    const key = sort in sortKeys ? sort : 'created_at';
    const av = key === 'spend' ? a.kpis.spend : key === 'roas' ? a.kpis.roas : a[key];
    const bv = key === 'spend' ? b.kpis.spend : key === 'roas' ? b.kpis.roas : b[key];
    return (av > bv ? 1 : av < bv ? -1 : 0) * (order === 'asc' ? 1 : -1);
  });
  const total = rows.length;
  const p = Math.max(1, Number(page));
  const ps = Math.min(100, Math.max(1, Number(pageSize)));
  res.json({ campaigns: rows.slice((p - 1) * ps, p * ps), total, page: p, pageSize: ps });
});

router.post('/workspaces/:workspaceId/campaigns', requireWorkspace(), (req, res) => {
  const { name, channel, status = 'draft', budget = 0, target_cpa, start_date, end_date } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Campaign name is required' });
  if (!CHANNELS.includes(channel)) return res.status(400).json({ error: `channel must be one of: ${CHANNELS.join(', ')}` });
  if (!STATUSES.includes(status)) return res.status(400).json({ error: `status must be one of: ${STATUSES.join(', ')}` });
  if (Number(budget) < 0) return res.status(400).json({ error: 'budget cannot be negative' });
  const info = db
    .prepare(
      `INSERT INTO campaigns (workspace_id, name, channel, status, budget, target_cpa, start_date, end_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.workspace.id, String(name).trim(), channel, status, Number(budget) || 0,
      target_cpa ? Number(target_cpa) : null, start_date || null, end_date || null, req.user.id);
  logActivity(req.workspace.id, req.user.id, 'campaign.created', name);
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ campaign: campaignWithKpis(campaign) });
});

router.get('/campaigns/:id', requireCampaign, (req, res) => {
  res.json({ campaign: campaignWithKpis(req.campaign), myRole: req.membership.role });
});

router.patch('/campaigns/:id', requireCampaign, (req, res) => {
  const allowed = ['name', 'channel', 'status', 'budget', 'target_cpa', 'start_date', 'end_date'];
  const updates = [];
  const values = [];
  for (const key of allowed) {
    if (req.body && key in req.body) {
      if (key === 'channel' && !CHANNELS.includes(req.body[key])) return res.status(400).json({ error: 'Invalid channel' });
      if (key === 'status' && !STATUSES.includes(req.body[key])) return res.status(400).json({ error: 'Invalid status' });
      updates.push(`${key} = ?`);
      values.push(req.body[key]);
    }
  }
  if (!updates.length) return res.status(400).json({ error: 'No updatable fields provided' });
  db.prepare(`UPDATE campaigns SET ${updates.join(', ')} WHERE id = ?`).run(...values, req.campaign.id);
  logActivity(req.campaign.workspace_id, req.user.id, 'campaign.updated', req.campaign.name);
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.campaign.id);
  res.json({ campaign: campaignWithKpis(campaign) });
});

router.delete('/campaigns/:id', requireCampaign, (req, res) => {
  if (req.membership.role === 'member') {
    return res.status(403).json({ error: 'Members cannot delete campaigns' });
  }
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.campaign.id);
  logActivity(req.campaign.workspace_id, req.user.id, 'campaign.deleted', req.campaign.name);
  res.json({ ok: true });
});

// ---- Metrics --------------------------------------------------------------

router.get('/campaigns/:id/metrics', requireCampaign, (req, res) => {
  const rows = db.prepare('SELECT * FROM metrics WHERE campaign_id = ? ORDER BY date').all(req.campaign.id);
  res.json({ metrics: rows });
});

const validMetric = (m) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date || '')) return 'date must be YYYY-MM-DD';
  for (const f of ['impressions', 'clicks', 'spend', 'conversions', 'revenue']) {
    if (Number(m[f] ?? 0) < 0) return `${f} cannot be negative`;
  }
  return null;
};

const upsertMetric = db.prepare(
  `INSERT INTO metrics (campaign_id, date, impressions, clicks, spend, conversions, revenue)
   VALUES (?, ?, ?, ?, ?, ?, ?)
   ON CONFLICT(campaign_id, date) DO UPDATE SET
     impressions = excluded.impressions, clicks = excluded.clicks, spend = excluded.spend,
     conversions = excluded.conversions, revenue = excluded.revenue`
);

const toMetricRow = (campaignId, m) => [
  campaignId,
  m.date,
  Math.trunc(Number(m.impressions) || 0),
  Math.trunc(Number(m.clicks) || 0),
  Number(m.spend) || 0,
  Math.trunc(Number(m.conversions) || 0),
  Number(m.revenue) || 0,
];

router.post('/campaigns/:id/metrics', requireCampaign, (req, res) => {
  const err = validMetric(req.body || {});
  if (err) return res.status(400).json({ error: err });
  upsertMetric.run(...toMetricRow(req.campaign.id, req.body));
  logActivity(req.campaign.workspace_id, req.user.id, 'metric.added', `${req.campaign.name} ${req.body.date}`);
  const rows = db.prepare('SELECT * FROM metrics WHERE campaign_id = ? ORDER BY date').all(req.campaign.id);
  res.status(201).json({ metrics: rows });
});

router.post('/campaigns/:id/metrics/import', requireCampaign, (req, res) => {
  const { csv } = req.body || {};
  if (!csv || typeof csv !== 'string') return res.status(400).json({ error: 'csv text is required' });
  const parsed = parseCsv(csv);
  if (!parsed.length) return res.status(400).json({ error: 'No data rows found in CSV' });
  let imported = 0;
  const errors = [];
  db.exec('BEGIN');
  try {
    for (const row of parsed) {
      const err = validMetric(row);
      if (err) { errors.push({ row, error: err }); continue; }
      upsertMetric.run(...toMetricRow(req.campaign.id, row));
      imported++;
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  logActivity(req.campaign.workspace_id, req.user.id, 'metric.imported', `${req.campaign.name}: ${imported} rows`);
  res.json({ imported, skipped: errors.length, errors: errors.slice(0, 10) });
});

router.delete('/campaigns/:id/metrics/:metricId', requireCampaign, (req, res) => {
  db.prepare('DELETE FROM metrics WHERE id = ? AND campaign_id = ?').run(Number(req.params.metricId), req.campaign.id);
  res.json({ ok: true });
});

export default router;
