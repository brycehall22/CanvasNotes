// src/nodes/link/LinkNode.tsx
//
// Link node. Two ways to open the URL:
//   1. Right-click anywhere on the node → opens immediately
//   2. Click without dragging (movement < 4px) → opens
//
// Both are needed: click-without-drag is the conventional gesture, but
// it's ambiguous (the user might mean to start a drag), so we surface a
// visible hint pointing to right-click as the unambiguous option.

import { useRef, useState } from 'react';
import { useBoard } from '../../store';
import { safeHttpUrl } from '../../lib/safeUrl';

interface Props { id: string; }

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function openUrl(url: string) {
  const safe = safeHttpUrl(url);
  if (safe) window.open(safe, '_blank', 'noopener,noreferrer');
}

export function LinkNodeContent({ id }: Props) {
  const node = useBoard((s) => s.nodes[id]);
  const updateNode = useBoard((s) => s.updateNode);
  const editing = useBoard((s) => s.editingNodeId === id);
  const setEditing = useBoard((s) => s.setEditing);
  const [input, setInput] = useState('');

  const downPos = useRef<{ x: number; y: number } | null>(null);
  const wasSelected = useRef(false);

  if (!node || node.kind !== 'link') return null;

  if (!node.url || editing) {
    return (
      <div className="nx-link-empty">
        <input
          type="url"
          placeholder="https://…"
          value={input || node.url}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const url = (input || node.url).trim();
              if (url) {
                const domain = extractDomain(url);
                updateNode(id, {
                  url,
                  preview: { title: domain || url, description: url },
                });
                setEditing(null);
              }
            }
            if (e.key === 'Escape') setEditing(null);
          }}
          autoFocus={editing}
        />
        <div className="nx-link-hint">Press enter to save</div>
      </div>
    );
  }

  const domain = extractDomain(node.url);
  const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : '';

const onPointerDown = (e: React.PointerEvent) => {
  downPos.current = { x: e.clientX, y: e.clientY };
  wasSelected.current = useBoard.getState().selectedIds.has(id);
};
const onPointerUp = (e: React.PointerEvent) => {
  if (!downPos.current) return;
  const dx = e.clientX - downPos.current.x;
  const dy = e.clientY - downPos.current.y;
  downPos.current = null;
  if (wasSelected.current && Math.abs(dx) < 4 && Math.abs(dy) < 4) openUrl(node.url);
};
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openUrl(node.url);
  };

  return (
    <div
      className="nx-link"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onContextMenu={onContextMenu}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openUrl(node.url);
      }}
    >
      <div className="nx-link-head">
        {faviconUrl && <img src={faviconUrl} alt="" width="16" height="16" draggable={false} />}
        <div className="nx-link-domain">{domain}</div>
      </div>
      <div className="nx-link-title">{node.preview?.title || node.url}</div>
      <div className="nx-link-url">{node.url}</div>
      <div className="nx-link-instruction">Right-click to open</div>
    </div>
  );
}
