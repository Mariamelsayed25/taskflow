import { BrowserRouter, Routes, Route, Navigate, NavLink, Outlet, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Boards from './pages/Boards';
import BoardDetails from './pages/BoardDetails';

function Layout() {
  const { user, loading, logout } = useAuth();
  if (loading) return <p className="center">Loading…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="shell">
      <aside>
        <h2>TaskFlow</h2>
        <NavLink to="/" end>Dashboard</NavLink>
        <NavLink to="/boards">My boards</NavLink>
        <div className="grow" />
        <small>{user.username}<br />{user.role}</small>
        <button className="btn ghost" onClick={logout}>Log out</button>
      </aside>
      <main><Outlet /></main>
    </div>
  );
}

const NotFound = () => <p className="center">Page not found. <Link to="/">Back to dashboard</Link></p>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Auth mode="login" />} />
          <Route path="/register" element={<Auth mode="register" />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/boards" element={<Boards />} />
            <Route path="/boards/:id" element={<BoardDetails />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
