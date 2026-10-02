import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const { user, login, register } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ username: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (e) => setF({ ...f, [e.target.name]: e.target.value });

  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/\S+@\S+\.\S+/.test(f.email)) return setError('Enter a valid email address');
    if (isRegister) {
      if (f.username.trim().length < 2) return setError('Username must be at least 2 characters');
      if (f.password.length < 6) return setError('Password must be at least 6 characters');
      if (f.password !== f.confirm) return setError('Passwords do not match');
    } else if (!f.password) return setError('Enter your password');
    setBusy(true);
    try {
      if (isRegister) await register(f.username, f.email, f.password);
      else await login(f.email, f.password);
      navigate('/');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>{isRegister ? 'Create your account' : 'Welcome back'}</h1>
        {error && <div className="error">{error}</div>}
        {isRegister && <input name="username" placeholder="Username" value={f.username} onChange={set} />}
        <input name="email" type="email" placeholder="Email" value={f.email} onChange={set} />
        <input name="password" type="password" placeholder="Password" value={f.password} onChange={set} />
        {isRegister && <input name="confirm" type="password" placeholder="Confirm password" value={f.confirm} onChange={set} />}
        <button className="btn" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Sign up' : 'Log in'}</button>
        {!isRegister && (
          <button type="button" className="btn ghost" onClick={() => setF({ ...f, email: 'demo@taskflow.com', password: '12345678' })}>
            Fill demo account
          </button>
        )}
        <p className="muted">
          {isRegister ? <>Already registered? <Link to="/login">Log in</Link></> : <>New here? <Link to="/register">Create an account</Link></>}
        </p>
      </form>
    </div>
  );
}
