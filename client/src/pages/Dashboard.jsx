import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtMoney, fmtNum, fmtPct } from '../api.js';
import { getWorkspaceId } from '../components/Layout.jsx';
import { LineChart, ChannelBars } from '../components/Charts.jsx';

function KpiCard({ label, value, sub }) {
  return (
    <div className="card kpi">
      <span className="kpi-label">{label}</span>
      <strong>{value}</strong>
      {sub && <span className="muted">{sub}</span>}
    </div>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const wsId = getWorkspaceId();

  useEffect(() => {
    if (!wsId) return;
    api(`/workspaces/${wsId}/dashboard`).then(setData).catch((e) => setError(e.message));
  }, [wsId]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading dashboard…</p>;
  const t = data.totals;

  return (
    <div>
      <header className="page-head">
        <div>
          <h1>{data.workspace.name}</h1>
          <p className="muted">{data.campaignCount} campaigns · {data.activeCampaigns} active · {fmtMoney(data.totalBudget)} total budget</p>
        </div>
        <Link className="primary btn" to="/campaigns">Manage campaigns</Link>
      </header>

      <section className="grid kpis">
        <KpiCard label="Total spend" value={fmtMoney(t.spend)} sub={`${fmtMoney(t.revenue)} revenue`} />
        <KpiCard label="Blended ROAS" value={`${t.roas}x`} sub={`${fmtPct(t.roi)} ROI`} />
        <KpiCard label="Conversions" value={fmtNum(t.conversions)} sub={`CPA ${fmtMoney(t.cpa)}`} />
        <KpiCard label="Impressions" value={fmtNum(t.impressions)} sub={`CTR ${fmtPct(t.ctr)} · CPC ${fmtMoney(t.cpc)}`} />
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Spend vs revenue</h2>
          <LineChart data={data.series} />
          <p className="legend"><span className="dot revenue" /> Revenue <span className="dot spend" /> Spend</p>
        </div>
        <div className="card">
          <h2>Channel mix (by spend)</h2>
          <ChannelBars data={data.channelBreakdown} />
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Insights</h2>
          {data.insights.length === 0 && <p className="muted">No issues detected. Every campaign is inside its guardrails.</p>}
          <ul className="insights">
            {data.insights.map((i, idx) => (
              <li key={idx} className={`insight ${i.level}`}>
                <span className="insight-tag">{i.level}</span> {i.message}
              </li>
            ))}
          </ul>
        </div>
        <div className="card">
          <h2>Top campaigns by ROAS</h2>
          <table className="table">
            <thead><tr><th>Campaign</th><th>Spend</th><th>ROAS</th><th>Budget used</th></tr></thead>
            <tbody>
              {data.topCampaigns.map(({ campaign, kpis, budgetUsedPct }) => (
                <tr key={campaign.id}>
                  <td><Link to={`/campaigns/${campaign.id}`}>{campaign.name}</Link><br /><span className="muted">{campaign.channel}</span></td>
                  <td>{fmtMoney(kpis.spend)}</td>
                  <td>{kpis.roas}x</td>
                  <td>
                    <div className="meter"><div style={{ width: `${budgetUsedPct}%` }} /></div>
                    <span className="muted">{budgetUsedPct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
