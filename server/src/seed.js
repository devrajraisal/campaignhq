// Seed data: a demo account with a workspace, four campaigns across channels
// and 30 days of deterministic metrics, so the dashboard is alive on first run.
// Usage: npm run seed   (safe to re-run — it wipes and recreates demo data)
import bcrypt from 'bcryptjs';
import { db, logActivity } from './db.js';

// Small deterministic PRNG so every seed produces the same demo story.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const DEMO_EMAIL = 'demo@campaignhq.app';
const DEMO_PASSWORD = 'demo1234';

// Remove any previous demo data first (workspaces cascade to campaigns,
// metrics, members, invites and activity), then the demo user itself.
db.exec('DELETE FROM workspaces WHERE owner_id IN (SELECT id FROM users WHERE email = \'demo@campaignhq.app\')');
db.exec('DELETE FROM users WHERE email = \'demo@campaignhq.app\'');

const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
const userId = db
  .prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
  .run('Devraj (Demo)', DEMO_EMAIL, hash).lastInsertRowid;

const workspaceId = db
  .prepare('INSERT INTO workspaces (name, owner_id) VALUES (?, ?)')
  .run('Devraj Growth Studio', userId).lastInsertRowid;
db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)')
  .run(workspaceId, userId, 'owner');

const campaigns = [
  { name: 'Diwali Sale — Prospecting', channel: 'Meta Ads', status: 'active', budget: 1500, target_cpa: 12, base: { impressions: 4200, ctr: 0.021, cpc: 0.42, convRate: 0.045, aov: 38 } },
  { name: 'Brand Search — Always On', channel: 'Google Ads', status: 'active', budget: 900, target_cpa: 9, base: { impressions: 550, ctr: 0.062, cpc: 0.85, convRate: 0.07, aov: 41 } },
  { name: 'UGC Spark Test', channel: 'TikTok Ads', status: 'active', budget: 600, target_cpa: 15, base: { impressions: 9000, ctr: 0.008, cpc: 0.3, convRate: 0.02, aov: 33 } },
  { name: 'B2B Lead Gen — SaaS', channel: 'LinkedIn Ads', status: 'paused', budget: 1200, target_cpa: 45, base: { impressions: 1200, ctr: 0.011, cpc: 2.9, convRate: 0.05, aov: 220 } },
];

const insertCampaign = db.prepare(
  `INSERT INTO campaigns (workspace_id, name, channel, status, budget, target_cpa, start_date, created_by)
   VALUES (?, ?, ?, ?, ?, ?, date('now', '-30 days'), ?)`
);
const insertMetric = db.prepare(
  `INSERT INTO metrics (campaign_id, date, impressions, clicks, spend, conversions, revenue)
   VALUES (?, date('now', ?), ?, ?, ?, ?, ?)`
);

for (const c of campaigns) {
  const campaignId = insertCampaign.run(workspaceId, c.name, c.channel, c.status, c.budget, c.target_cpa, userId).lastInsertRowid;
  for (let d = 29; d >= 0; d--) {
    if (c.status === 'paused' && d < 12) continue; // paused campaigns stop reporting
    const wave = 1 + 0.35 * Math.sin(d / 5) + (rand() - 0.5) * 0.3;
    const impressions = Math.round(c.base.impressions * wave);
    const clicks = Math.round(impressions * c.base.ctr * (0.85 + rand() * 0.3));
    const spend = Number((clicks * c.base.cpc * (0.9 + rand() * 0.2)).toFixed(2));
    const conversions = Math.round(clicks * c.base.convRate * (0.8 + rand() * 0.4));
    const revenue = Number((conversions * c.base.aov * (0.9 + rand() * 0.25)).toFixed(2));
    insertMetric.run(campaignId, `-${d} days`, impressions, clicks, spend, conversions, revenue);
  }
}

logActivity(workspaceId, userId, 'workspace.seeded', 'Demo data generated');
console.log(`Seed complete. Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
