// Board search — find nodes by text and jump to them (⌘F).

import { useMemo, useRef, useState } from 'react';
import { useBoard } from '../store';
import { nodeSearchText, type CanvasNode } from '../types/domain';

interface Props {
  open: boolean;
  onClose: () => void;
  hostRef: React.RefObject<HTMLDivElement>;
}

function kindLabel(kind: CanvasNode['kind']): string {
  switch (kind) {
    case 'text': return 'Note';
    case 'sticky': return 'Sticky';
    case 'todo': return 'Todo';
    case 'shape': return 'Shape';
    case 'frame': return 'Frame';
    case 'image': return 'Image';
    case 'video': return 'Video';
    case 'link': return 'Link';
    default: return kind;
  }
}

function snippet(text: string, query: string, max = 80): string {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text.slice(0, max) + (text.length > max ? '…' : '');
  const start = Math.max(0, idx - 20);
  const end = Math.min(text.length, idx + q.length + 40);
  let s = text.slice(start, end).replace(/\s+/g, ' ').trim();
  if (start > 0) s = '…' + s;
  if (end < text.length) s = s + '…';
  return s;
}

export function SearchPanel({ open, onClose, hostRef }: Props) {
  if (!open) return null;
  return <SearchPanelBody onClose={onClose} hostRef={hostRef} />;
}

function SearchPanelBody({ onClose, hostRef }: Omit<Props, 'open'>) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodes = useBoard((s) => s.nodes);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const out: { id: string; node: CanvasNode; text: string }[] = [];
    for (const n of Object.values(nodes)) {
      const text = nodeSearchText(n);
      if (text.toLowerCase().includes(q)) {
        out.push({ id: n.id, node: n, text });
      }
    }
    // Prefer shorter matches / titles first
    out.sort((a, b) => a.text.length - b.text.length);
    return out.slice(0, 40);
  }, [nodes, query]);

  const jump = (id: string) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    useBoard.getState().focusNode(id, rect.width, rect.height);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="nx-search-panel"
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label="Search board"
    >
      <div className="nx-search-row">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
        <input
          ref={inputRef}
          autoFocus
          className="nx-search-input"
          placeholder="Search notes, stickies, frames…"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActive(0); }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); onClose(); }
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            }
            if (e.key === 'Enter' && results[active]) {
              e.preventDefault();
              jump(results[active].id);
            }
          }}
        />
        <kbd className="nx-search-kbd">esc</kbd>
      </div>
      {query.trim() && (
        <ul className="nx-search-results">
          {results.length === 0 && (
            <li className="nx-search-empty">No matches</li>
          )}
          {results.map((r, i) => (
            <li key={r.id}>
              <button
                type="button"
                className={i === active ? 'nx-search-hit active' : 'nx-search-hit'}
                onClick={() => jump(r.id)}
                onMouseEnter={() => setActive(i)}
              >
                <span className="nx-search-kind">{kindLabel(r.node.kind)}</span>
                <span className="nx-search-snippet">{snippet(r.text, query)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
