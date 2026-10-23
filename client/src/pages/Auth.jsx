import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, setToken } from '../api.js';

function AuthShell({ title, subtitle, children }) {
  return (
    <div className="auth-wrap">
      <form className="auth-card" onSubmit={(e) => e.preventDefault()}>
        <div className="logo big">Campaign<span>HQ</span></div>
        <h1>{title}</h1>
        <p className="muted">{subtitle}</p>
        {children}
      </form>
    </div>
  );
}

export function Login() {
  const [email, setEmail] = useState('demo@campaignhq.app');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async () => {
    setError('');
    try {
      const { token } = await api('/auth/login', { method: 'POST', body: { email, password } });
      setToken(token);
      navigate('/dashboard');
    } catch (e) { setError(e.message); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Demo account is pre-filled — or use your own.">
      {error && <p className="error">{error}</p>}
      <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
      <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required /></label>
      <button className="primary" onClick={submit}>Log in</button>
      <p className="muted center">New here? <Link to="/register">Create an account</Link></p>
    </AuthShell>
  );
}

export function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setError('');
    try {
      const { token } = await api('/auth/register', { method: 'POST', body: form });
      setToken(token);
      navigate('/dashboard');
    } catch (e) { setError(e.message); }
  };

  return (
    <AuthShell title="Create your account" subtitle="A personal workspace is created for you automatically.">
      {error && <p className="error">{error}</p>}
      <label>Full name<input value={form.name} onChange={set('name')} required /></label>
      <label>Email<input value={form.email} onChange={set('email')} type="email" required /></label>
      <label>Password (8+ characters)<input value={form.password} onChange={set('password')} type="password" required /></label>
      <button className="primary" onClick={submit}>Sign up</button>
      <p className="muted center">Already registered? <Link to="/login">Log in</Link></p>
    </AuthShell>
  );
}
