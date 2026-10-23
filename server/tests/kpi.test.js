import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeKpis, sumMetrics, parseCsv } from '../src/utils/kpi.js';
import { generateInsights } from '../src/utils/insights.js';

test('computeKpis calculates the standard marketing metrics', () => {
  const k = computeKpis({ impressions: 10000, clicks: 250, spend: 500, conversions: 25, revenue: 2000 });
  assert.equal(k.ctr, 2.5);
  assert.equal(k.cpc, 2);
  assert.equal(k.cpm, 50);
  assert.equal(k.cpa, 20);
  assert.equal(k.roas, 4);
  assert.equal(k.roi, 300);
  assert.equal(k.conversionRate, 10);
});

test('computeKpis never divides by zero', () => {
  const k = computeKpis({ impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 });
  for (const key of ['ctr', 'cpc', 'cpm', 'cpa', 'roas', 'roi', 'conversionRate']) {
    assert.equal(k[key], 0, `${key} should be 0`);
  }
});

test('sumMetrics aggregates rows', () => {
  const total = sumMetrics([
    { impressions: 100, clicks: 5, spend: 10, conversions: 1, revenue: 40 },
    { impressions: 200, clicks: 15, spend: 30, conversions: 3, revenue: 60 },
  ]);
  assert.deepEqual(total, { impressions: 300, clicks: 20, spend: 40, conversions: 4, revenue: 100 });
});

test('parseCsv handles headers, quoted commas and blank lines', () => {
  const rows = parseCsv('date,impressions,note\n2026-10-01,100,"hello, world"\n\n2026-10-02,200,plain\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].note, 'hello, world');
  assert.equal(rows[1].impressions, '200');
});

test('insights flag CPA above target and celebrate strong ROAS', () => {
  const campaign = { name: 'Test', budget: 1000, target_cpa: 10, status: 'active' };
  const kpis = computeKpis({ impressions: 5000, clicks: 200, spend: 400, conversions: 20, revenue: 1600 });
  const insights = generateInsights(campaign, kpis, { daysSinceLastMetric: 0 });
  assert.ok(insights.some((i) => i.type === 'cpa_above_target'));
  assert.ok(insights.some((i) => i.type === 'strong_roas'));
});

test('insights flag an exhausted budget as danger', () => {
  const campaign = { name: 'Spent', budget: 100, target_cpa: null, status: 'active' };
  const kpis = computeKpis({ impressions: 10, clicks: 1, spend: 120, conversions: 1, revenue: 10 });
  const insights = generateInsights(campaign, kpis, {});
  assert.ok(insights.some((i) => i.type === 'budget_exhausted' && i.level === 'danger'));
});
