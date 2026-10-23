import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, requireWorkspace, requireCampaign } from '../middleware/auth.js';
import { computeKpis, sumMetrics } from '../utils/kpi.js';
import { generateInsights } from '../utils/insights.js';

const router = Router();
router.use(requireAuth);

function daysSince(dateStr) {
  if (!dateStr) return null;
  const then = new Date(dateStr + 'T00:00:00Z').getTime();
  return Math.floor((Date.now() - then) / 86400000);
}

// Per-campaign analytics: totals, KPIs, daily time series and insights.
router.get('/campaigns/:id/analytics', requireCampaign, (req, res) => {
  const rows = db.prepare('SELECT * FROM metrics WHERE campaign_id = ? ORDER BY date').all(req.campaign.id);
  const kpis = computeKpis(sumMetrics(rows));
  const series = rows.map((r) => ({ date: r.date, ...computeKpis(r) }));
  const last = rows.length ? rows[rows.length - 1].date : null;
  const insights = generateInsights(req.campaign, kpis, { daysSinceLastMetric: daysSince(last) });
  res.json({ campaign: req.campaign, kpis, series, insights });
});

// Workspace dashboard: everything a marketer needs on one screen — totals,
// channel mix, top campaigns, budget pacing and cross-campaign insights.
router.get('/workspaces/:workspaceId/dashboard', requireWorkspace(), (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns WHERE workspace_id = ?').all(req.workspace.id);
  const allMetrics = db
    .prepare(
      `SELECT m.* FROM metrics m JOIN campaigns c ON c.id = m.campaign_id WHERE c.workspace_id = ?`
    )
    .all(req.workspace.id);

  const totals = computeKpis(sumMetrics(allMetrics));

  const byChannel = {};
  for (const c of campaigns) {
    const rows = db.prepare('SELECT * FROM metrics WHERE campaign_id = ?').all(c.id);
    if (!byChannel[c.channel]) byChannel[c.channel] = [];
    byChannel[c.channel].push(...rows);
  }
  const channelBreakdown = Object.entries(byChannel).map(([channel, rows]) => ({
    channel,
    ...computeKpis(sumMetrics(rows)),
  })).sort((a, b) => b.spend - a.spend);

  const perCampaign = campaigns.map((c) => {
    const rows = db.prepare('SELECT * FROM metrics WHERE campaign_id = ? ORDER BY date').all(c.id);
    const kpis = computeKpis(sumMetrics(rows));
    const last = rows.length ? rows[rows.length - 1].date : null;
    return {
      campaign: c,
      kpis,
      budgetUsedPct: c.budget > 0 ? Math.min(100, Math.round((kpis.spend / c.budget) * 100)) : 0,
      insights: generateInsights(c, kpis, { daysSinceLastMetric: daysSince(last) }),
    };
  });

  // Daily series across the whole workspace for the trend chart.
  const byDate = {};
  for (const m of allMetrics) {
    if (!byDate[m.date]) byDate[m.date] = [];
    byDate[m.date].push(m);
  }
  const series = Object.keys(byDate).sort().map((date) => ({ date, ...computeKpis(sumMetrics(byDate[date])) }));

  const topCampaigns = [...perCampaign].sort((a, b) => b.kpis.roas - a.kpis.roas).slice(0, 5);
  const insights = perCampaign.flatMap((p) => p.insights.map((i) => ({ ...i, campaignId: p.campaign.id })));

  res.json({
    workspace: req.workspace,
    totals,
    totalBudget: campaigns.reduce((s, c) => s + (c.budget || 0), 0),
    activeCampaigns: campaigns.filter((c) => c.status === 'active').length,
    campaignCount: campaigns.length,
    channelBreakdown,
    topCampaigns,
    series,
    insights,
  });
});

export default router;
