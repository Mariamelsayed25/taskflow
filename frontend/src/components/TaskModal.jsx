import { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../AuthContext';

// task = existing task (edit) or { list } (create)
export default function TaskModal({ task, members, onClose, onChanged }) {
  const { user } = useAuth();
  const isNew = !task._id;
  const [f, setF] = useState({
    title: task.title || '', description: task.description || '', status: task.status || 'todo',
    priority: task.priority || 'medium', dueDate: task.dueDate ? task.dueDate.slice(0, 10) : '', assignedTo: task.assignedTo?._id || '',
  });
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const set = (e) => setF({ ...f, [e.target.name]: e.target.value });

  const loadComments = () => api.get(`/tasks/${task._id}/comments`).then((r) => setComments(r.data.data)).catch((e) => setError(e.message));
  useEffect(() => { if (!isNew) loadComments(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    if (!f.title.trim()) return setError('Title is required');
    try {
      const body = { title: f.title, description: f.description, priority: f.priority, dueDate: f.dueDate || null };
      if (isNew) {
        await api.post(`/lists/${task.list}/tasks`, { ...body, status: f.status, assignedTo: f.assignedTo || undefined });
      } else {
        await api.put(`/tasks/${task._id}`, body);
        if (f.status !== task.status) await api.put(`/tasks/${task._id}/status`, { status: f.status });
        if (f.assignedTo !== (task.assignedTo?._id || '')) await api.put(`/tasks/${task._id}/assign`, { assignedTo: f.assignedTo || null });
      }
      onChanged(); onClose();
    } catch (err) { setError(err.message); }
  };

  const remove = async () => {
    if (!confirm('Delete this task?')) return;
    try { await api.delete(`/tasks/${task._id}`); onChanged(); onClose(); } catch (err) { setError(err.message); }
  };

  const addComment = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    try { await api.post(`/tasks/${task._id}/comments`, { text }); setText(''); loadComments(); onChanged(); } catch (err) { setError(err.message); }
  };
  const delComment = async (id) => { try { await api.delete(`/comments/${id}`); loadComments(); } catch (err) { setError(err.message); } };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="card modal wide" onClick={(e) => e.stopPropagation()}>
        <form onSubmit={save}>
          <h2>{isNew ? 'New task' : 'Task details'}</h2>
          {error && <div className="error">{error}</div>}
          <input name="title" placeholder="Title" value={f.title} onChange={set} />
          <textarea name="description" placeholder="Description" value={f.description} onChange={set} />
          <div className="fields">
            <label>Status<select name="status" value={f.status} onChange={set}><option value="todo">To do</option><option value="in_progress">In progress</option><option value="done">Done</option></select></label>
            <label>Priority<select name="priority" value={f.priority} onChange={set}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label>Due date<input type="date" name="dueDate" value={f.dueDate} onChange={set} /></label>
            <label>Assigned to<select name="assignedTo" value={f.assignedTo} onChange={set}><option value="">Unassigned</option>{members.map((m) => <option key={m._id} value={m._id}>{m.username}</option>)}</select></label>
          </div>
          {!isNew && <p className="muted">Created by {task.createdBy?.username} on {new Date(task.createdAt).toLocaleDateString()} · updated {new Date(task.updatedAt).toLocaleDateString()}</p>}
          <div className="row">
            <button className="btn">Save task</button>
            <button type="button" className="btn ghost" onClick={onClose}>Close</button>
            {!isNew && <button type="button" className="btn danger" onClick={remove}>Delete</button>}
          </div>
        </form>
        {!isNew && (
          <section>
            <h3>Comments</h3>
            {comments.length === 0 && <p className="muted">No comments yet. Start the discussion.</p>}
            {comments.map((c) => (
              <div className="comment" key={c._id}>
                <b>{c.user?.username}</b> <small className="muted">{new Date(c.createdAt).toLocaleString()}</small>
                {c.user?._id === user._id && <button className="link" onClick={() => delComment(c._id)}>Delete</button>}
                <p>{c.text}</p>
              </div>
            ))}
            <form className="row" onSubmit={addComment}><input placeholder="Write a comment" value={text} onChange={(e) => setText(e.target.value)} /><button className="btn">Add comment</button></form>
          </section>
        )}
      </div>
    </div>
  );
}
