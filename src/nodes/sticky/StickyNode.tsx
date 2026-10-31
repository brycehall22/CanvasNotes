// Sticky note — short plain-text card, often color-coded (Miro/Milanote style).

import { useEffect, useRef } from 'react';
import { useBoard } from '../../store';

interface Props { id: string; }

export function StickyNodeContent({ id }: Props) {
  const node = useBoard((s) => s.nodes[id]);
  const editing = useBoard((s) => s.editingNodeId === id);
  const updateNode = useBoard((s) => s.updateNode);
  const setEditing = useBoard((s) => s.setEditing);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && taRef.current) {
      const ta = taRef.current;
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    }
  }, [editing]);

  if (!node || node.kind !== 'sticky') return null;

  if (editing) {
    return (
      <textarea
        ref={taRef}
        className="nx-sticky-editor"
        value={node.text}
        onChange={(e) => updateNode(id, { text: e.target.value })}
        onBlur={() => setEditing(null)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.currentTarget.blur();
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') e.currentTarget.blur();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder="Jot something…"
      />
    );
  }

  return (
    <div className="nx-sticky-read">
      {node.text || <span className="nx-placeholder">Double-click to write</span>}
    </div>
  );
}
