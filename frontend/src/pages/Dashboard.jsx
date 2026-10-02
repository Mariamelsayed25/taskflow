import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import BoardCard from '../components/BoardCard';

const fmt = (d) => new Date(d).toLocaleDateString();

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [boards, setBoards] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.get('/dashboard'), api.get('/boards')])
      .then(([a, b]) => { setD(a.data.data); setBoards(b.data.data); })
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="error">{error}</div>;
  if (!d) return <p className="center">Loading…</p>;
  const s = d.stats;
  const stats = [['Boards', s.totalBoards], ['Tasks', s.totalTasks], ['To do', s.todo], ['In progress', s.in_progress], ['Done', s.done], ['Due in 7 days', s.upcoming], ['Overdue', s.overdue]];

  return (
    <>
      <div className="head"><h1>Dashboard</h1><Link className="btn" to="/boards" state={{ create: true }}>Create board</Link></div>
      <div className="stats">{stats.map(([k, v]) => <div className="card stat" key={k}><b>{v}</b><span>{k}</span></div>)}</div>

      <h2>Recent boards</h2>
      {boards.length === 0 ? <p className="muted">No boards yet. Create your first board to get started.</p>
        : <div className="grid">{boards.slice(0, 3).map((b) => <BoardCard key={b._id} board={b} />)}</div>}

      <div className="two">
        <section className="card">
          <h2>Upcoming deadlines</h2>
          {d.upcomingTasks.length === 0 && <p className="muted">Nothing due soon.</p>}
          {d.upcomingTasks.map((t) => (
            <Link key={t._id} to={`/boards/${t.board._id}`} className="item">
              <span>{t.title}<small>{t.board.title}</small></span><span className="muted">{fmt(t.dueDate)}</span>
            </Link>
          ))}
        </section>
        <section className="card">
          <h2>Recent tasks</h2>
          {d.recentTasks.map((t) => (
            <Link key={t._id} to={`/boards/${t.board._id}`} className="item">
              <span>{t.title}<small>{t.assignedTo?.username || 'Unassigned'}</small></span><span className={`pill ${t.status}`}>{t.status.replace('_', ' ')}</span>
            </Link>
          ))}
        </section>
      </div>

      <section className="card">
        <h2>Recent activity</h2>
        {d.activity.length === 0 && <p className="muted">No activity yet.</p>}
        {d.activity.map((a) => (
          <p key={a._id} className="item"><span><b>{a.user?.username}</b> {a.action} "{a.target}"<small>{a.board?.title}</small></span><span className="muted">{fmt(a.createdAt)}</span></p>
        ))}
      </section>
    </>
  );
}
