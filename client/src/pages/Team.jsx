import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { getWorkspaceId } from '../components/Layout.jsx';

export default function Team() {
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [activity, setActivity] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [lastInvite, setLastInvite] = useState(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const wsId = getWorkspaceId();

  const load = () => {
    if (!wsId) return;
    api(`/workspaces/${wsId}/members`).then(({ members, invites }) => { setMembers(members); setInvites(invites); }).catch((e) => setError(e.message));
    api(`/workspaces/${wsId}/activity?limit=30`).then(({ activity }) => setActivity(activity)).catch(() => {});
  };
  useEffect(load, [wsId]);

  const invite = async () => {
    setError(''); setMsg('');
    try {
      const { invite } = await api(`/workspaces/${wsId}/invites`, { method: 'POST', body: { email, role } });
      setLastInvite(invite);
      setEmail('');
      load();
    } catch (e) { setError(e.message); }
  };

  const accept = async () => {
    const token = window.prompt('Paste the invite token:');
    if (!token) return;
    try {
      await api('/workspaces/invites/accept', { method: 'POST', body: { token } });
      setMsg('Invite accepted — switch workspaces from the sidebar.');
    } catch (e) { setError(e.message); }
  };

  const createWorkspace = async () => {
    if (!name.trim()) return;
    try {
      const { workspace } = await api('/workspaces', { method: 'POST', body: { name } });
      localStorage.setItem('hq_workspace', String(workspace.id));
      window.location.reload();
    } catch (e) { setError(e.message); }
  };

  return (
    <div>
      <header className="page-head"><h1>Team & Activity</h1></header>
      {error && <p className="error">{error}</p>}
      {msg && <p className="success">{msg}</p>}

      <section className="grid two">
        <div className="card">
          <h2>Members</h2>
          <table className="table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}><td>{m.name}</td><td>{m.email}</td><td><span className="pill">{m.role}</span></td></tr>
              ))}
            </tbody>
          </table>
          {invites.length > 0 && (
            <>
              <h3>Pending invites</h3>
              <ul className="insights">
                {invites.map((i) => <li key={i.id} className="insight info">{i.email} — {i.role}</li>)}
              </ul>
            </>
          )}
          <h3>Invite a teammate</h3>
          <div className="filters">
            <input placeholder="teammate@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select value={role} onChange={(e) => setRole(e.target.value)}><option>member</option><option>admin</option></select>
            <button className="primary" onClick={invite}>Invite</button>
          </div>
          {lastInvite && (
            <p className="muted">Share this token with {lastInvite.email}: <code>{lastInvite.token}</code></p>
          )}
          <button className="ghost" onClick={accept}>I have an invite token</button>
        </div>

        <div className="card">
          <h2>Recent activity</h2>
          <ul className="activity">
            {activity.map((a) => (
              <li key={a.id}>
                <span className="muted">{new Date(a.created_at + 'Z').toLocaleString()}</span><br />
                <strong>{a.user_name || 'Someone'}</strong> — {a.action} {a.details && <span className="muted">({a.details})</span>}
              </li>
            ))}
            {activity.length === 0 && <li className="muted">No activity yet.</li>}
          </ul>
          <h3>New workspace</h3>
          <div className="filters">
            <input placeholder="Client or brand name" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="primary" onClick={createWorkspace}>Create</button>
          </div>
        </div>
      </section>
    </div>
  );
}
