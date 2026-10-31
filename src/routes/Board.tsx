// src/routes/Board.tsx
// Loads a board's contents from IndexedDB, mounts the Stage, enables auto-save.

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Stage } from '../canvas/Stage';
import { Toolbar } from '../ui/Toolbar';
import { SelectionBar } from '../ui/SelectionBar';
import { SearchPanel } from '../ui/SearchPanel';
import { MiniMap } from '../ui/MiniMap';
import { ThemeToggle } from '../ui/ThemeToggle';
import { useBoard } from '../store';
import { getBoard, loadBoardContents, renameBoard } from '../persistence/indexeddb';
import { useAutoSave } from '../persistence/useAutoSave';
import type { Board as BoardType } from '../types/domain';

export function Board() {
  const { id } = useParams<{ id: string }>();
  const [meta, setMeta] = useState<BoardType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const [editingName, setEditingName] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useAutoSave();

  useEffect(() => {
    const open = () => setSearchOpen(true);
    window.addEventListener('nx:open-search', open);
    return () => window.removeEventListener('nx:open-search', open);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) { setError('Missing board id'); return; }
      const board = await getBoard(id);
      if (!board) { setError('Board not found'); return; }
      const contents = await loadBoardContents(id);
      if (cancelled) return;
      setMeta(board);
      useBoard.getState().loadBoard(id, {
        nodes: contents.nodes,
        edges: contents.edges,
        viewport: board.viewport,
      });
      // Spawn a starter node on brand-new boards so the canvas isn't blank
      if (contents.nodes.length === 0) {
        useBoard.getState().addNodeAt('text', 100, 80, {
          markdown: `# Welcome to NexusCanvas

- **⌘F** search the board · **⌘G** frame selection
- **Frame** clusters nodes — drag the frame to move everything inside
- Sticky, Todo, colors, sharp zoom, multi-select
- **Drag** empty canvas to pan · **Shift+drag** marquee
- **⌘D** duplicate · arrows nudge · **⌘Z** undo`,
          width: 400, height: 260,
        });
      }
      setLoaded(true);
    };
    load();
    return () => {
      cancelled = true;
      useBoard.getState().resetBoard();
    };
  }, [id]);

  if (error) {
    return (
      <div className="nx-board-error">
        <p>{error}</p>
        <Link to="/" className="nx-primary-btn">Back to dashboard</Link>
      </div>
    );
  }

  return (
    <div className="nx-board-route">
      <header className="nx-board-header">
        <Link to="/" className="nx-back-link" aria-label="Back to dashboard">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        {meta && (
          editingName ? (
            <input
              className="nx-board-name-input"
              defaultValue={meta.name}
              autoFocus
              onBlur={async (e) => {
                const name = e.currentTarget.value.trim();
                if (name && name !== meta.name && id) {
                  await renameBoard(id, name);
                  setMeta({ ...meta, name });
                }
                setEditingName(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
                if (e.key === 'Escape') { (e.currentTarget as HTMLInputElement).value = meta.name; e.currentTarget.blur(); }
              }}
            />
          ) : (
            <h1 className="nx-board-name" onClick={() => setEditingName(true)}>{meta.name}</h1>
          )
        )}
        <div className="nx-board-header-spacer" />
        <div className="nx-hint-text">drag to pan · shift+drag select · ⌘D duplicate · ⌘Z undo</div>
        <ThemeToggle />
      </header>

      <div className="nx-board-canvas-wrap nx-board-host" ref={hostRef}>
        {loaded && (
          <>
            <Stage />
            <Toolbar hostRef={hostRef as React.RefObject<HTMLDivElement>} />
            <SelectionBar />
            <SearchPanel
              open={searchOpen}
              onClose={() => setSearchOpen(false)}
              hostRef={hostRef as React.RefObject<HTMLDivElement>}
            />
            <MiniMap hostRef={hostRef as React.RefObject<HTMLDivElement>} />
          </>
        )}
      </div>
    </div>
  );
}
