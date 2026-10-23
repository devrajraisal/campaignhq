import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, fmtMoney, fmtNum, fmtPct } from '../api.js';
import { LineChart } from '../components/Charts.jsx';

const EMPTY = { date: new Date().toISOString().slice(0, 10), impressions: '', clicks: '', spend: '', conversions: '', revenue: '' };
const CSV_TEMPLATE = 'date,impressions,clicks,spend,conversions,revenue\n2026-10-01,12000,340,210.50,18,720\n2026-10-02,13500,402,238.00,21,815';

export default function CampaignDetail() {
  const { id } = useParams();
  const [analytics, setAnalytics] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [csv, setCsv] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    api(`/campaigns/${id}/analytics`).then(setAnalytics).catch((e) => setError(e.message));
    api(`/campaigns/${id}/metrics`).then(({ metrics }) => setMetrics(metrics)).catch(() => {});
  };
  useEffect(load, [id]);

  const addMetric = async () => {
    setError(''); setMsg('');
    try {
      const body = { ...form };
      for (const k of ['impressions', 'clicks', 'spend', 'conversions', 'revenue']) body[k] = Number(form[k]) || 0;
      await api(`/campaigns/${id}/metrics`, { method: 'POST', body });
      setForm(EMPTY);
      load();
    } catch (e) { setError(e.message); }
  };

  const importCsv = async () => {
    setError(''); setMsg('');
    try {
      const res = await api(`/campaigns/${id}/metrics/import`, { method: 'POST', body: { csv } });
      setMsg(`Imported ${res.imported} rows${res.skipped ? `, skipped ${res.skipped}` : ''}.`);
      setCsv('');
      load();
    } catch (e) { setError(e.message); }
  };

  const setStatus = async (status) => {
    await api(`/campaigns/${id}`, { method: 'PATCH', body: { status } });
    load();
  };

  if (error && !analytics) return <p className="error">{error}</p>;
  if (!analytics) return <p className="muted">Loading campaign…</p>;
  const { campaign, kpis, series, insights } = analytics;
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div>
      <p className="muted"><Link to="/campaigns">← All campaigns</Link></p>
      <header className="page-head">
        <div>
          <h1>{campaign.name}</h1>
          <p className="muted">{campaign.channel} · Budget {fmtMoney(campaign.budget)}{campaign.target_cpa ? ` · Target CPA ${fmtMoney(campaign.target_cpa)}` : ''}</p>
        </div>
        <select value={campaign.status} onChange={(e) => setStatus(e.target.value)} aria-label="Campaign status">
          <option>draft</option><option>active</option><option>paused</option><option>completed</option>
        </select>
      </header>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      <section className="grid kpis">
        <div className="card kpi"><span className="kpi-label">Spend</span><strong>{fmtMoney(kpis.spend)}</strong><span className="muted">{fmtMoney(kpis.revenue)} revenue</span></div>
        <div className="card kpi"><span className="kpi-label">ROAS</span><strong>{kpis.roas}x</strong><span className="muted">{fmtPct(kpis.roi)} ROI</span></div>
        <div className="card kpi"><span className="kpi-label">CPA</span><strong>{fmtMoney(kpis.cpa)}</strong><span className="muted">{fmtNum(kpis.conversions)} conversions</span></div>
        <div className="card kpi"><span className="kpi-label">CTR</span><strong>{fmtPct(kpis.ctr)}</strong><span className="muted">CPC {fmtMoney(kpis.cpc)} · CPM {fmtMoney(kpis.cpm)}</span></div>
      </section>

      <section className="grid two">
        <div className="card"><h2>Performance trend</h2><LineChart data={series} /></div>
        <div className="card">
          <h2>Insights</h2>
          {insights.length === 0 && <p className="muted">Nothing flagged for this campaign.</p>}
          <ul className="insights">{insights.map((i, idx) => <li key={idx} className={`insight ${i.level}`}><span className="insight-tag">{i.level}</span> {i.message}</li>)}</ul>
        </div>
      </section>

      <section className="grid two">
        <div className="card">
          <h2>Add a day of metrics</h2>
          <div className="form-grid">
            <label>Date<input type="date" value={form.date} onChange={set('date')} /></label>
            <label>Impressions<input type="number" value={form.impressions} onChange={set('impressions')} /></label>
            <label>Clicks<input type="number" value={form.clicks} onChange={set('clicks')} /></label>
            <label>Spend<input type="number" value={form.spend} onChange={set('spend')} /></label>
            <label>Conversions<input type="number" value={form.conversions} onChange={set('conversions')} /></label>
            <label>Revenue<input type="number" value={form.revenue} onChange={set('revenue')} /></label>
          </div>
          <button className="primary" onClick={addMetric}>Save metric</button>
        </div>
        <div className="card">
          <h2>Import CSV</h2>
          <p className="muted">Paste rows in this format (existing dates are overwritten):</p>
          <pre className="code">{CSV_TEMPLATE}</pre>
          <textarea rows="5" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="Paste CSV here…" />
          <button className="primary" onClick={importCsv} disabled={!csv.trim()}>Import</button>
        </div>
      </section>

      <div className="card">
        <h2>Daily metrics</h2>
        <table className="table">
          <thead><tr><th>Date</th><th>Impressions</th><th>Clicks</th><th>Spend</th><th>Conv.</th><th>Revenue</th></tr></thead>
          <tbody>
            {[...metrics].reverse().map((m) => (
              <tr key={m.id}><td>{m.date}</td><td>{fmtNum(m.impressions)}</td><td>{fmtNum(m.clicks)}</td><td>{fmtMoney(m.spend)}</td><td>{m.conversions}</td><td>{fmtMoney(m.revenue)}</td></tr>
            ))}
            {metrics.length === 0 && <tr><td colSpan="6" className="muted">No metrics yet — add a day or import a CSV.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
