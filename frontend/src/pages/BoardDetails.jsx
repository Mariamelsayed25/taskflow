import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import TaskModal from '../components/TaskModal';

const FILTERS = [['all', 'All'], ['todo', 'To do'], ['in_progress', 'In progress'], ['done', 'Done']];

export default function BoardDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [newList, setNewList] = useState('');

  const load = useCallback(async () => {
    try {
      const [b, a] = await Promise.all([api.get(`/boards/${id}`), api.get(`/boards/${id}/activity`)]);
      setData(b.data.data); setActivity(a.data.data);
    } catch (e) { setError(e.message); }
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <><div className="error">{error}</div><Link to="/boards">Back to boards</Link></>;
  if (!data) return <p className="center">Loading…</p>;
  const { board, lists, tasks } = data;

  const act = async (fn) => { try { await fn(); load(); } catch (e) { setError(e.message); } };
  const addList = (e) => { e.preventDefault(); if (!newList.trim()) return; act(() => api.post(`/boards/${id}/lists`, { title: newList })); setNewList(''); };
  const delList = (l) => confirm(`Delete list "${l.title}" and its tasks?`) && act(() => api.delete(`/lists/${l._id}`));
  const setStatus = (t, status) => act(() => api.put(`/tasks/${t._id}/status`, { status }));
  const visible = (t) => (filter === 'all' || t.status === filter) && t.title.toLowerCase().includes(search.toLowerCase());

  return (
    <>
      <div className="head">
        <div><h1>{board.title}</h1><p className="muted">{board.description}</p></div>
        <button className="btn ghost" onClick={() => navigate('/boards')}>All boards</button>
      </div>
      <div className="row filters">
        {FILTERS.map(([k, label]) => <button key={k} className={`btn ${filter === k ? '' : 'ghost'}`} onClick={() => setFilter(k)}>{label}</button>)}
        <input placeholder="Search tasks" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="kanban">
        {lists.map((l) => {
          const items = tasks.filter((t) => t.list === l._id && visible(t));
          return (
            <div className="column" key={l._id}>
              <div className="col-head"><b>{l.title}</b><span className="muted">{items.length}</span><button className="link" onClick={() => delList(l)}>Delete</button></div>
              {items.length === 0 && <p className="muted small">No tasks yet</p>}
              {items.map((t) => (
                <div className="task" key={t._id} onClick={() => setModal(t)}>
                  <b>{t.title}</b>
                  <p className="muted small">{t.description}</p>
                  <div className="row">
                    <span className={`pill ${t.priority}`}>{t.priority}</span>
                    {t.dueDate && <span className="muted small">Due {new Date(t.dueDate).toLocaleDateString()}</span>}
                  </div>
                  <div className="row" onClick={(e) => e.stopPropagation()}>
                    <span className="small">{t.assignedTo?.username || 'Unassigned'}</span>
                    <select className={`pill ${t.status}`} value={t.status} onChange={(e) => setStatus(t, e.target.value)}>
                      <option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option>
                    </select>
                  </div>
                </div>
              ))}
              <button className="btn ghost" onClick={() => setModal({ list: l._id })}>+ Add task</button>
            </div>
          );
        })}
        <form className="column" onSubmit={addList}>
          <input placeholder="New list title" value={newList} onChange={(e) => setNewList(e.target.value)} />
          <button className="btn">Add list</button>
        </form>
      </div>
      {lists.length === 0 && <div className="card empty"><h3>No lists yet</h3><p className="muted">Add your first list to start planning.</p></div>}

      <section className="card">
        <h2>Board activity</h2>
        {activity.map((a) => <p key={a._id} className="item"><span><b>{a.user?.username}</b> {a.action} "{a.target}"</span><span className="muted">{new Date(a.createdAt).toLocaleDateString()}</span></p>)}
      </section>

      {modal && <TaskModal task={modal} members={board.members} onClose={() => setModal(null)} onChanged={load} />}
    </>
  );
}
