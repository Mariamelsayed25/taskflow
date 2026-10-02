import { Link } from 'react-router-dom';

export default function BoardCard({ board, onEdit, onDelete }) {
  return (
    <div className="card board-card">
      <h3>{board.title}</h3>
      <p className="muted">{board.description || 'No description'}</p>
      <p className="muted">{board.listCount} lists · {board.taskCount} tasks · updated {new Date(board.updatedAt).toLocaleDateString()}</p>
      <div className="row">
        <Link className="btn" to={`/boards/${board._id}`}>Open</Link>
        {onEdit && <button className="btn ghost" onClick={() => onEdit(board)}>Edit</button>}
        {onDelete && <button className="btn danger" onClick={() => onDelete(board)}>Delete</button>}
      </div>
    </div>
  );
}
