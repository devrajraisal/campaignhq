import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// In-memory DB + ephemeral port: the API is tested end to end over HTTP.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'test-secret';

let server;
let base;
let token;
let workspaceId;
let campaignId;

before(async () => {
  const { createApp } = await import('../src/app.js');
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => server.close());

const call = async (method, path, body, auth = true) => {
  const res = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json() };
};

test('health check responds', async () => {
  const { status, json } = await call('GET', '/api/health', null, false);
  assert.equal(status, 200);
  assert.equal(json.ok, true);
});

test('register creates a user, token and personal workspace', async () => {
  const { status, json } = await call('POST', '/api/auth/register', {
    name: 'Test User', email: 'test@example.com', password: 'password123',
  }, false);
  assert.equal(status, 201);
  token = json.token;
  const ws = await call('GET', '/api/workspaces');
  assert.equal(ws.json.workspaces.length, 1);
  workspaceId = ws.json.workspaces[0].id;
});

test('unauthenticated requests are rejected', async () => {
  const res = await fetch(base + '/api/workspaces');
  assert.equal(res.status, 401);
});

test('campaign + metric flow produces correct analytics', async () => {
  const created = await call('POST', `/api/workspaces/${workspaceId}/campaigns`, {
    name: 'Launch Push', channel: 'Meta Ads', status: 'active', budget: 500, target_cpa: 25,
  });
  assert.equal(created.status, 201);
  campaignId = created.json.campaign.id;

  await call('POST', `/api/campaigns/${campaignId}/metrics`, {
    date: '2026-10-20', impressions: 10000, clicks: 500, spend: 250, conversions: 20, revenue: 900,
  });
  await call('POST', `/api/campaigns/${campaignId}/metrics`, {
    date: '2026-10-21', impressions: 10000, clicks: 500, spend: 250, conversions: 20, revenue: 900,
  });

  const { json } = await call('GET', `/api/campaigns/${campaignId}/analytics`);
  assert.equal(json.kpis.impressions, 20000);
  assert.equal(json.kpis.spend, 500);
  assert.equal(json.kpis.cpa, 12.5);
  assert.equal(json.kpis.roas, 3.6);
  assert.equal(json.series.length, 2);
});

test('CSV import upserts rows and reports a count', async () => {
  const csv = 'date,impressions,clicks,spend,conversions,revenue\n2026-10-22,5000,250,125,10,450\n2026-10-20,11000,550,275,22,990';
  const { status, json } = await call('POST', `/api/campaigns/${campaignId}/metrics/import`, { csv });
  assert.equal(status, 200);
  assert.equal(json.imported, 2);
  const analytics = await call('GET', `/api/campaigns/${campaignId}/analytics`);
  // 2026-10-20 was overwritten by the import (11000 impressions), totals grow.
  assert.equal(analytics.json.kpis.impressions, 26000);
});

test('dashboard aggregates the workspace', async () => {
  const { status, json } = await call('GET', `/api/workspaces/${workspaceId}/dashboard`);
  assert.equal(status, 200);
  assert.equal(json.campaignCount, 1);
  assert.equal(json.channelBreakdown[0].channel, 'Meta Ads');
});

test('invalid campaign payloads are rejected', async () => {
  const { status } = await call('POST', `/api/workspaces/${workspaceId}/campaigns`, {
    name: 'Bad', channel: 'Carrier Pigeon',
  });
  assert.equal(status, 400);
});
