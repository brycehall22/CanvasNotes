// Frame — titled region; can collapse to a compact card.

import { useEffect, useRef } from 'react';
import { useBoard } from '../../store';

interface Props { id: string; }

export function FrameNodeContent({ id }: Props) {
  const node = useBoard((s) => s.nodes[id]);
  const editing = useBoard((s) => s.editingNodeId === id);
  const updateNode = useBoard((s) => s.updateNode);
  const setEditing = useBoard((s) => s.setEditing);
  const toggleFrameCollapse = useBoard((s) => s.toggleFrameCollapse);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (!node || node.kind !== 'frame') return null;

  return (
    <div className="nx-frame">
      <div
        className="nx-frame-titlebar"
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditing(id);
        }}
      >
        <button
          type="button"
          className="nx-frame-collapse nx-no-drag"
          title={node.collapsed ? 'Expand frame' : 'Collapse frame'}
          onClick={(e) => {
            e.stopPropagation();
            toggleFrameCollapse(id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {node.collapsed ? '▸' : '▾'}
        </button>
        {editing ? (
          <input
            ref={inputRef}
            className="nx-frame-title-input nx-no-drag"
            value={node.title}
            onChange={(e) => updateNode(id, { title: e.target.value })}
            onBlur={() => setEditing(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="nx-frame-title">{node.title || 'Frame'}</span>
        )}
      </div>
      {!node.collapsed && <div className="nx-frame-body" aria-hidden="true" />}
    </div>
  );
}
