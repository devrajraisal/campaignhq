import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtMoney } from '../api.js';
import { getWorkspaceId } from '../components/Layout.jsx';

const CHANNELS = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads', 'Email', 'Other'];
const EMPTY = { name: '', channel: 'Meta Ads', status: 'active', budget: 1000, target_cpa: '', start_date: '', end_date: '' };

export default function Campaigns() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '', channel: '' });
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const wsId = getWorkspaceId();

  const load = () => {
    const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
    api(`/workspaces/${wsId}/campaigns?${qs}`).then(({ campaigns }) => setRows(campaigns)).catch((e) => setError(e.message));
  };
  useEffect(load, [filters, wsId]);

  const create = async () => {
    setError('');
    try {
      await api(`/workspaces/${wsId}/campaigns`, {
        method: 'POST',
        body: { ...form, budget: Number(form.budget), target_cpa: form.target_cpa ? Number(form.target_cpa) : null },
      });
      setForm(EMPTY);
      setShowForm(false);
      load();
    } catch (e) { setError(e.message); }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this campaign and all its metrics?')) return;
    try { await api(`/campaigns/${id}`, { method: 'DELETE' }); load(); }
    catch (e) { setError(e.message); }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const setF = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });

  return (
    <div>
      <header className="page-head">
        <h1>Campaigns</h1>
        <button className="primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close' : 'New campaign'}</button>
      </header>
      {error && <p className="error">{error}</p>}

      {showForm && (
        <div className="card form-grid">
          <label>Name<input value={form.name} onChange={set('name')} placeholder="Ramadan Push — Retargeting" /></label>
          <label>Channel
            <select value={form.channel} onChange={set('channel')}>{CHANNELS.map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label>Status
            <select value={form.status} onChange={set('status')}>
              <option>draft</option><option>active</option><option>paused</option><option>completed</option>
            </select>
          </label>
          <label>Budget (USD)<input type="number" value={form.budget} onChange={set('budget')} /></label>
          <label>Target CPA<input type="number" value={form.target_cpa} onChange={set('target_cpa')} placeholder="Optional" /></label>
          <label>Start date<input type="date" value={form.start_date} onChange={set('start_date')} /></label>
          <label>End date<input type="date" value={form.end_date} onChange={set('end_date')} /></label>
          <button className="primary" onClick={create}>Create campaign</button>
        </div>
      )}

      <div className="card">
        <div className="filters">
          <input placeholder="Search campaigns…" value={filters.search} onChange={setF('search')} />
          <select value={filters.status} onChange={setF('status')}>
            <option value="">All statuses</option><option>draft</option><option>active</option><option>paused</option><option>completed</option>
          </select>
          <select value={filters.channel} onChange={setF('channel')}>
            <option value="">All channels</option>{CHANNELS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <table className="table">
          <thead><tr><th>Campaign</th><th>Status</th><th>Budget</th><th>Spend</th><th>Conv.</th><th>CPA</th><th>ROAS</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link to={`/campaigns/${c.id}`}>{c.name}</Link><br /><span className="muted">{c.channel}</span></td>
                <td><span className={`pill ${c.status}`}>{c.status}</span></td>
                <td>{fmtMoney(c.budget)}</td>
                <td>{fmtMoney(c.kpis.spend)}</td>
                <td>{c.kpis.conversions}</td>
                <td>{fmtMoney(c.kpis.cpa)}</td>
                <td>{c.kpis.roas}x</td>
                <td><button className="ghost danger" onClick={() => remove(c.id)}>Delete</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan="8" className="muted">No campaigns match. Create one to get started.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
