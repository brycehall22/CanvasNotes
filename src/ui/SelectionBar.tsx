// Floating bar for the current selection — colors, shapes, edge style.

import { useBoard } from '../store';
import {
  NODE_COLORS,
  SHAPE_TYPES,
  type NodeColor,
  type ShapeType,
  type EdgeArrow,
} from '../types/domain';

const COLOR_LABELS: Record<NodeColor, string> = {
  default: 'Default',
  yellow: 'Yellow',
  orange: 'Orange',
  red: 'Red',
  pink: 'Pink',
  purple: 'Purple',
  blue: 'Blue',
  teal: 'Teal',
  green: 'Green',
  gray: 'Gray',
};

const SHAPE_LABELS: Record<ShapeType, string> = {
  rect: 'Rectangle',
  rounded: 'Rounded',
  ellipse: 'Ellipse',
  diamond: 'Diamond',
};

const ARROWS: { id: EdgeArrow; label: string }[] = [
  { id: 'none', label: 'No arrow' },
  { id: 'end', label: '→' },
  { id: 'start', label: '←' },
  { id: 'both', label: '↔' },
];

export function SelectionBar() {
  const nodeCount = useBoard((s) => s.selectedIds.size);
  const edgeId = useBoard((s) => s.selectedEdgeId);
  const edge = useBoard((s) => (s.selectedEdgeId ? s.edges[s.selectedEdgeId] : null));
  const hasShape = useBoard((s) =>
    Array.from(s.selectedIds).some((id) => s.nodes[id]?.kind === 'shape')
  );

  if (nodeCount === 0 && !edgeId) return null;

  // Edge selected — compact connector tools
  if (edgeId && edge) {
    return (
      <div className="nx-selection-bar" onPointerDown={(e) => e.stopPropagation()}>
        <span className="nx-selection-count">Connector</span>
        <div className="nx-edge-tools" role="group" aria-label="Arrow style">
          {ARROWS.map((a) => (
            <button
              key={a.id}
              type="button"
              className={
                (edge.arrow || 'end') === a.id
                  ? 'nx-edge-tool active'
                  : 'nx-edge-tool'
              }
              title={a.label}
              onClick={() =>
                useBoard.getState().updateEdge(edgeId, { arrow: a.id })
              }
            >
              {a.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={
            edge.style === 'dashed' ? 'nx-edge-tool active' : 'nx-edge-tool'
          }
          title="Dashed"
          onClick={() =>
            useBoard
              .getState()
              .updateEdge(edgeId, {
                style: edge.style === 'dashed' ? 'solid' : 'dashed',
              })
          }
        >
          Dashed
        </button>
        <button
          type="button"
          className={
            edge.path === 'straight' ? 'nx-edge-tool active' : 'nx-edge-tool'
          }
          title="Straight / curve"
          onClick={() =>
            useBoard
              .getState()
              .updateEdge(edgeId, {
                path: edge.path === 'straight' ? 'bezier' : 'straight',
              })
          }
        >
          {edge.path === 'straight' ? 'Straight' : 'Curve'}
        </button>
        <button
          type="button"
          className="nx-selection-dup"
          title="Delete connector (Shift+click)"
          onClick={() => useBoard.getState().deleteEdge(edgeId)}
        >
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="nx-selection-bar" onPointerDown={(e) => e.stopPropagation()}>
      <span className="nx-selection-count">{nodeCount} selected</span>
      <div className="nx-color-swatches" role="group" aria-label="Node color">
        {NODE_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            className={`nx-swatch nx-swatch-${c}`}
            title={COLOR_LABELS[c]}
            aria-label={COLOR_LABELS[c]}
            onClick={() => useBoard.getState().setSelectionColor(c)}
          />
        ))}
      </div>
      {hasShape && (
        <div className="nx-shape-tools" role="group" aria-label="Shape type">
          {SHAPE_TYPES.map((s) => (
            <button
              key={s}
              type="button"
              className="nx-shape-tool"
              title={SHAPE_LABELS[s]}
              aria-label={SHAPE_LABELS[s]}
              onClick={() => useBoard.getState().setSelectionShape(s)}
            >
              <ShapeIcon type={s} />
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        className="nx-selection-dup"
        title="Frame selection (⌘G)"
        onClick={() => useBoard.getState().frameSelection()}
      >
        Frame
      </button>
      <button
        type="button"
        className="nx-selection-dup"
        title="Duplicate (⌘D)"
        onClick={() => useBoard.getState().duplicateSelection()}
      >
        Duplicate
      </button>
    </div>
  );
}

function ShapeIcon({ type }: { type: ShapeType }) {
  const common = {
    width: 16,
    height: 12,
    viewBox: '0 0 16 12',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
  } as const;
  switch (type) {
    case 'rect':
      return (
        <svg {...common}>
          <rect x="1" y="1" width="14" height="10" />
        </svg>
      );
    case 'rounded':
      return (
        <svg {...common}>
          <rect x="1" y="1" width="14" height="10" rx="3" />
        </svg>
      );
    case 'ellipse':
      return (
        <svg {...common}>
          <ellipse cx="8" cy="6" rx="7" ry="5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg {...common}>
          <path d="M8 1 L15 6 L8 11 L1 6 Z" />
        </svg>
      );
  }
}
