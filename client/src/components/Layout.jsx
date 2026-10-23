import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';

export const WS_KEY = 'hq_workspace';
export const getWorkspaceId = () => Number(localStorage.getItem(WS_KEY)) || null;
export const setWorkspaceId = (id) => localStorage.setItem(WS_KEY, String(id));

export default function Layout() {
  const [workspaces, setWorkspaces] = useState([]);
  const [current, setCurrent] = useState(getWorkspaceId());
  const navigate = useNavigate();

  useEffect(() => {
    api('/workspaces').then(({ workspaces }) => {
      setWorkspaces(workspaces);
      if (workspaces.length && !workspaces.some((w) => w.id === getWorkspaceId())) {
        setCurrent(workspaces[0].id);
        setWorkspaceId(workspaces[0].id);
      }
    }).catch(() => {});
  }, []);

  const switchWs = (id) => {
    setCurrent(Number(id));
    setWorkspaceId(id);
    navigate('/dashboard');
    window.location.reload();
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem(WS_KEY);
    navigate('/login');
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo">Campaign<span>HQ</span></div>
        <select className="ws-select" value={current || ''} onChange={(e) => switchWs(e.target.value)} aria-label="Active workspace">
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/campaigns">Campaigns</NavLink>
          <NavLink to="/team">Team & Activity</NavLink>
        </nav>
        <button className="ghost logout" onClick={logout}>Log out</button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
