// KPI engine: turns raw marketing totals into the metrics marketers actually
// optimise against. Every division is guarded — a campaign with zero spend or
// zero impressions returns 0s instead of NaN/Infinity.

const round = (n, dp = 2) => {
  const f = 10 ** dp;
  return Math.round((Number(n) || 0) * f) / f;
};

export function computeKpis(totals = {}) {
  const impressions = Number(totals.impressions) || 0;
  const clicks = Number(totals.clicks) || 0;
  const spend = Number(totals.spend) || 0;
  const conversions = Number(totals.conversions) || 0;
  const revenue = Number(totals.revenue) || 0;

  return {
    impressions,
    clicks,
    spend: round(spend),
    conversions,
    revenue: round(revenue),
    ctr: impressions > 0 ? round((clicks / impressions) * 100, 2) : 0, // %
    cpc: clicks > 0 ? round(spend / clicks) : 0,
    cpm: impressions > 0 ? round((spend / impressions) * 1000) : 0,
    cpa: conversions > 0 ? round(spend / conversions) : 0,
    roas: spend > 0 ? round(revenue / spend) : 0, // x revenue per unit spend
    roi: spend > 0 ? round(((revenue - spend) / spend) * 100, 2) : 0, // %
    conversionRate: clicks > 0 ? round((conversions / clicks) * 100, 2) : 0, // %
  };
}

export function sumMetrics(rows) {
  const total = { impressions: 0, clicks: 0, spend: 0, conversions: 0, revenue: 0 };
  for (const r of rows) {
    total.impressions += Number(r.impressions) || 0;
    total.clicks += Number(r.clicks) || 0;
    total.spend += Number(r.spend) || 0;
    total.conversions += Number(r.conversions) || 0;
    total.revenue += Number(r.revenue) || 0;
  }
  return total;
}

// Minimal CSV parser for metric imports: header row required, quoted fields
// with commas are supported. Returns an array of row objects keyed by header.
export function parseCsv(text) {
  const lines = String(text).split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const splitLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  };
  const headers = splitLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = splitLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}
