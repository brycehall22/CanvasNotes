// Diagram shape — centered label, double-click to edit (draw.io-style).

import { useEffect, useRef } from 'react';
import { useBoard } from '../../store';
import type { ShapeType } from '../../types/domain';

interface Props { id: string; }

function shapePath(type: ShapeType, w: number, h: number): string {
  switch (type) {
    case 'rect':
      return `M 0 0 H ${w} V ${h} H 0 Z`;
    case 'rounded': {
      const r = Math.min(16, w / 4, h / 4);
      return `M ${r} 0 H ${w - r} Q ${w} 0 ${w} ${r} V ${h - r} Q ${w} ${h} ${w - r} ${h} H ${r} Q 0 ${h} 0 ${h - r} V ${r} Q 0 0 ${r} 0 Z`;
    }
    case 'ellipse':
      return `M ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 1 ${w / 2 - 0.01} 0 Z`;
    case 'diamond':
      return `M ${w / 2} 0 L ${w} ${h / 2} L ${w / 2} ${h} L 0 ${h / 2} Z`;
  }
}

export function ShapeNodeContent({ id }: Props) {
  const node = useBoard((s) => s.nodes[id]);
  const editing = useBoard((s) => s.editingNodeId === id);
  const updateNode = useBoard((s) => s.updateNode);
  const setEditing = useBoard((s) => s.setEditing);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && taRef.current) {
      const ta = taRef.current;
      ta.focus();
      ta.select();
    }
  }, [editing]);

  if (!node || node.kind !== 'shape') return null;

  const { width, height, shape, text } = node;
  const d = shapePath(shape, width, height);

  return (
    <div className={`nx-shape nx-shape-${shape}`}>
      <svg
        className="nx-shape-svg"
        width="100%"
        height="100%"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d={d} className="nx-shape-path" />
      </svg>
      <div className="nx-shape-label">
        {editing ? (
          <textarea
            ref={taRef}
            className="nx-shape-editor nx-no-drag"
            value={text}
            onChange={(e) => updateNode(id, { text: e.target.value })}
            onBlur={() => setEditing(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') e.currentTarget.blur();
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') e.currentTarget.blur();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="nx-shape-text">{text || 'Double-click'}</span>
        )}
      </div>
    </div>
  );
}
