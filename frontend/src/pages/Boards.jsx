import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../api';
import BoardCard from '../components/BoardCard';

export default function Boards() {
  const location = useLocation();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(location.state?.create ? { title: '', description: '' } : null); // null = closed

  const load = () => api.get('/boards').then((r) => setBoards(r.data.data)).catch((e) => setError(e.message)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) return setError('Title is required');
    try {
      const body = { title: form.title, description: form.description };
      if (form._id) await api.put(`/boards/${form._id}`, body); else await api.post('/boards', body);
      setForm(null); load();
    } catch (err) { setError(err.message); }
  };

  const remove = async (b) => {
    if (!confirm(`Delete "${b.title}" and all its lists and tasks?`)) return;
    try { await api.delete(`/boards/${b._id}`); load(); } catch (err) { setError(err.message); }
  };

  return (
    <>
      <div className="head"><h1>My boards</h1><button className="btn" onClick={() => setForm({ title: '', description: '' })}>Create board</button></div>
      {error && <div className="error">{error}</div>}
      {loading ? <p className="center">Loading…</p> : boards.length === 0
        ? <div className="card empty"><h3>No boards yet</h3><p className="muted">Create your first board to start organizing work.</p></div>
        : <div className="grid">{boards.map((b) => <BoardCard key={b._id} board={b} onEdit={setForm} onDelete={remove} />)}</div>}
      {form && (
        <div className="modal-bg" onClick={() => setForm(null)}>
          <form className="card modal" onClick={(e) => e.stopPropagation()} onSubmit={save}>
            <h2>{form._id ? 'Edit board' : 'New board'}</h2>
            <input placeholder="Board title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <textarea placeholder="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="row"><button className="btn">Save board</button><button type="button" className="btn ghost" onClick={() => setForm(null)}>Cancel</button></div>
          </form>
        </div>
      )}
    </>
  );
}
