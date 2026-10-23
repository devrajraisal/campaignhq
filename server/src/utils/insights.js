// Rule-based insight engine: scans a campaign's KPIs and budget pacing and
// returns plain-language findings a marketer can act on. Rules are ordered
// from most to least urgent.

export function generateInsights(campaign, kpis, { daysSinceLastMetric = null } = {}) {
  const insights = [];
  const name = campaign.name;

  if (campaign.budget > 0 && kpis.spend >= campaign.budget) {
    insights.push({
      level: 'danger',
      type: 'budget_exhausted',
      message: `${name} has spent ${kpis.spend} of its ${campaign.budget} budget. Pause it or raise the budget.`,
    });
  } else if (campaign.budget > 0 && kpis.spend >= campaign.budget * 0.9) {
    insights.push({
      level: 'warning',
      type: 'budget_almost_gone',
      message: `${name} has used over 90% of its budget (${kpis.spend}/${campaign.budget}).`,
    });
  }

  if (campaign.target_cpa && kpis.conversions > 0 && kpis.cpa > campaign.target_cpa) {
    insights.push({
      level: 'warning',
      type: 'cpa_above_target',
      message: `${name} is acquiring at CPA ${kpis.cpa}, above the target of ${campaign.target_cpa}. Tighten targeting or creative.`,
    });
  }

  if (kpis.impressions >= 1000 && kpis.ctr < 1) {
    insights.push({
      level: 'warning',
      type: 'low_ctr',
      message: `${name} has a CTR of only ${kpis.ctr}% across ${kpis.impressions} impressions. The hook/creative is likely the problem.`,
    });
  }

  if (kpis.roas >= 3 && kpis.spend > 0) {
    insights.push({
      level: 'success',
      type: 'strong_roas',
      message: `${name} is returning ${kpis.roas}x ROAS. This is a scaling candidate — consider increasing budget gradually.`,
    });
  }

  if (campaign.status === 'active' && daysSinceLastMetric !== null && daysSinceLastMetric > 7) {
    insights.push({
      level: 'info',
      type: 'stale_data',
      message: `${name} is marked active but has no metrics in the last ${daysSinceLastMetric} days. Import fresh data to keep decisions accurate.`,
    });
  }

  if (kpis.clicks >= 100 && kpis.conversions === 0) {
    insights.push({
      level: 'warning',
      type: 'no_conversions',
      message: `${name} has ${kpis.clicks} clicks and zero conversions. Check the landing page and conversion tracking.`,
    });
  }

  return insights;
}
