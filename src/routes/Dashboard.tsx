// src/routes/Dashboard.tsx
// Board list + create/delete/rename. Entry point of the app.

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listBoards, createBoard, deleteBoard, renameBoard } from '../persistence/indexeddb';
import { ThemeToggle } from '../ui/ThemeToggle';
import type { Board } from '../types/domain';

export function Dashboard() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const navigate = useNavigate();

  const refresh = async () => {
    setBoards(await listBoards());
    setNow(Date.now());
  };

  useEffect(() => {
    let cancelled = false;
    listBoards().then((b) => {
      if (cancelled) return;
      setBoards(b);
      setNow(Date.now());
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    const board = await createBoard(`Untitled board ${boards.length + 1}`);
    navigate(`/board/${board.id}`);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteBoard(id);
    refresh();
  };

  const startRename = (board: Board) => {
    setRenamingId(board.id);
    setRenameValue(board.name);
  };

  const commitRename = async () => {
    if (renamingId && renameValue.trim()) {
      await renameBoard(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    refresh();
  };

function formatDate(ts: number, now: number) {
  const diff = now - ts;
  const min = 60 * 1000;
  const hr = 60 * min;
  const day = 24 * hr;
  if (diff < min) return 'Just now';
  if (diff < hr) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hr)}h ago`;
  if (diff < 7 * day) return `${Math.floor(diff / day)}d ago`;
  return new Date(ts).toLocaleDateString();
}

  return (
    <div className="nx-dashboard">
      <header className="nx-dashboard-header">
        <div>
          <h1>NexusCanvas</h1>
          <p>Spatial notes where thinking can breathe.</p>
        </div>
        <div className="nx-dashboard-actions">
          <ThemeToggle />
          <button className="nx-primary-btn" onClick={handleCreate}>+ New board</button>
        </div>
      </header>

      {loading ? (
        <div className="nx-dashboard-empty">Loading…</div>
      ) : boards.length === 0 ? (
        <div className="nx-dashboard-empty">
          <p>No boards yet.</p>
          <button className="nx-primary-btn" onClick={handleCreate}>Create your first board</button>
        </div>
      ) : (
        <div className="nx-board-grid">
          {boards.map((b) => (
            <div key={b.id} className="nx-board-card">
              <Link to={`/board/${b.id}`} className="nx-board-card-body">
                <div className="nx-board-card-preview" aria-hidden="true" />
                {renamingId === b.id ? (
                  <input
                    className="nx-board-rename-input"
                    value={renameValue}
                    autoFocus
                    onClick={(e) => e.preventDefault()}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                  />
                ) : (
                  <div className="nx-board-card-name">{b.name}</div>
                )}
                <div className="nx-board-card-meta">{formatDate(b.updatedAt, now)}</div>
              </Link>
              <div className="nx-board-card-actions">
                <button
                  onClick={(e) => { e.preventDefault(); startRename(b); }}
                  aria-label="Rename"
                  title="Rename"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); handleDelete(b.id, b.name); }}
                  aria-label="Delete"
                  title="Delete"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
