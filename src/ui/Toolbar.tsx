// src/ui/Toolbar.tsx
// Floating toolbar. Undo/redo on the left, node creators on the right.

import { useBoard } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { screenToWorld } from '../canvas/coords';
import type { NodeKind } from '../types/domain';

export function Toolbar({ hostRef }: { hostRef: React.RefObject<HTMLDivElement> }) {
  const { tool, setTool } = useBoard(useShallow((s) => ({ tool: s.tool, setTool: s.setTool })));

  // Subscribe to history stack lengths so the buttons enable/disable live
  const pastLen = useBoard((s) => s.past.length);
  const futureLen = useBoard((s) => s.future.length);

  const addNodeOfKind = (kind: NodeKind) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const vp = useBoard.getState().viewport;
    const world = screenToWorld(rect.width / 2, rect.height / 2, vp);
    const size = kind === 'video' ? 280 : 240;
    const id = useBoard.getState().addNodeAt(kind, world.x - size / 2, world.y - 60);
    if (kind === 'text' || kind === 'link') useBoard.getState().setEditing(id);
    useBoard.getState().select(id);
  };

  const undo = () => useBoard.getState().undo();
  const redo = () => useBoard.getState().redo();
  const makeFrame = () => useBoard.getState().frameSelection();
  const openSearch = () => window.dispatchEvent(new CustomEvent('nx:open-search'));

  return (
    <div className="nx-toolbar" onPointerDown={(e) => e.stopPropagation()}>
      <button
        className="nx-tool nx-tool-icon"
        onClick={undo}
        disabled={pastLen === 0}
        title="Undo (⌘Z)"
        aria-label="Undo"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7v6h6" />
          <path d="M3 13a9 9 0 109-9" />
        </svg>
      </button>
      <button
        className="nx-tool nx-tool-icon"
        onClick={redo}
        disabled={futureLen === 0}
        title="Redo (⌘⇧Z)"
        aria-label="Redo"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 7v6h-6" />
          <path d="M21 13a9 9 0 11-9-9" />
        </svg>
      </button>
      <div className="nx-tool-divider" />
      <button
        className={tool === 'select' ? 'nx-tool nx-tool-icon active' : 'nx-tool nx-tool-icon'}
        onClick={() => setTool('select')}
        title="Select (V) · Shift+drag for marquee"
        aria-label="Select tool"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 3l7.07 17.95 2.52-7.36 7.36-2.52L3 3z" />
        </svg>
      </button>
      <button
        className={tool === 'pan' ? 'nx-tool nx-tool-icon active' : 'nx-tool nx-tool-icon'}
        onClick={() => setTool('pan')}
        title="Pan (H)"
        aria-label="Pan tool"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 11V6a2 2 0 00-4 0v1" />
          <path d="M14 10V4a2 2 0 00-4 0v6" />
          <path d="M10 10.5V8a2 2 0 00-4 0v8a5 5 0 0010 0v-3.5" />
          <path d="M18 8a2 2 0 014 0v7a5 5 0 01-5 5h-2" />
        </svg>
      </button>
      <button
        className="nx-tool nx-tool-icon"
        onClick={openSearch}
        title="Search board (⌘F)"
        aria-label="Search board"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </button>
      <button
        className="nx-tool"
        onClick={makeFrame}
        title="Frame selection (⌘G)"
        aria-label="Frame selection"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
        </svg>
        <span>Frame</span>
      </button>
      <div className="nx-tool-divider" />
      <button
        className="nx-tool"
        onClick={() => addNodeOfKind('text')}
        title="Add text note"
        aria-label="Add text note"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 12h10M4 18h16" />
        </svg>
        <span>Text</span>
      </button>
      <button
        className="nx-tool"
        onClick={() => addNodeOfKind('sticky')}
        title="Add sticky note"
        aria-label="Add sticky note"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V9l-6-6z" />
          <path d="M15 3v6h6" />
        </svg>
        <span>Sticky</span>
      </button>
      <button
        className="nx-tool"
        onClick={() => addNodeOfKind('todo')}
        title="Add checklist"
        aria-label="Add checklist"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
        <span>Todo</span>
      </button>
      <button
        className="nx-tool"
        onClick={() => addNodeOfKind('shape')}
        title="Add diagram shape"
        aria-label="Add shape"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="3" />
        </svg>
        <span>Shape</span>
      </button>
      <button
        className="nx-tool"
        onClick={() => addNodeOfKind('image')}
        title="Add image"
        aria-label="Add image"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <path d="M21 15l-5-5-8 8" />
        </svg>
        <span>Image</span>
      </button>
      <button
        className="nx-tool"
        onClick={() => addNodeOfKind('video')}
        title="Add video"
        aria-label="Add video"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="14" height="12" rx="2" />
          <path d="M17 10l5-3v10l-5-3z" fill="currentColor" />
        </svg>
        <span>Video</span>
      </button>
      <button
        className="nx-tool"
        onClick={() => addNodeOfKind('link')}
        title="Add link"
        aria-label="Add link"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 14a5 5 0 007 0l3-3a5 5 0 00-7-7l-1 1" />
          <path d="M14 10a5 5 0 00-7 0l-3 3a5 5 0 007 7l1-1" />
        </svg>
        <span>Link</span>
      </button>
    </div>
  );
}
