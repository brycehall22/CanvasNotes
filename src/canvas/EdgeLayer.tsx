// src/canvas/EdgeLayer.tsx
//
// Edges in screen-space (world × zoom). Arrowheads are drawn as real path
// geometry (not SVG <marker>), so start / end / both always render reliably.

import { memo, useEffect, useRef } from 'react';
import { useBoard } from '../store';
import {
  anchorsFor,
  anchorsToPoint,
  pathString,
  insetForArrows,
  arrowHeadPath,
  arrowTips,
  ARROW_SIZE,
  type EdgeAnchors,
} from '../edges/geometry';
import type { CanvasNode, Edge } from '../types/domain';

function scaleAnchors(a: EdgeAnchors, z: number): EdgeAnchors {
  return {
    from: { x: a.from.x * z, y: a.from.y * z },
    to:   { x: a.to.x * z,   y: a.to.y * z },
    c1:   { x: a.c1.x * z,   y: a.c1.y * z },
    c2:   { x: a.c2.x * z,   y: a.c2.y * z },
  };
}

export const EdgeLayer = memo(function EdgeLayer() {
  const edgeIds = useBoard((s) => Object.keys(s.edges));
  const nodeIds = useBoard((s) => Object.keys(s.nodes));
  const selectedEdgeId = useBoard((s) => s.selectedEdgeId);

  const ghostRef = useRef<SVGPathElement>(null);
  const ghostHeadRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    const update = () => {
      const { nodes, edges, connecting, viewport } = useBoard.getState();
      const z = viewport.zoom;
      const headSize = ARROW_SIZE * Math.max(z, 0.5);

      for (const e of Object.values(edges)) {
        const a = nodes[e.from];
        const b = nodes[e.to];
        if (!a || !b) continue;

        const line = document.querySelector<SVGPathElement>(
          `[data-edge-id="${e.id}"] .nx-edge-line`
        );
        const hit = document.querySelector<SVGPathElement>(
          `[data-edge-id="${e.id}"] .nx-edge-hit`
        );
        const headStart = document.querySelector<SVGPathElement>(
          `[data-edge-id="${e.id}"] .nx-edge-head-start`
        );
        const headEnd = document.querySelector<SVGPathElement>(
          `[data-edge-id="${e.id}"] .nx-edge-head-end`
        );
        if (!line) continue;

        const pathMode = e.path === 'straight' ? 'straight' : 'bezier';
        const arrow = e.arrow ?? 'end';
        const raw = scaleAnchors(anchorsFor(a, b), z);
        // Scale size in screen px for inset (ARROW_SIZE is world-ish; we work in screen space)
        const inset = insetForArrows(raw, arrow, pathMode, headSize);
        const d = pathString(inset, pathMode);
        line.setAttribute('d', d);
        if (hit) hit.setAttribute('d', d);

        line.setAttribute('stroke-dasharray', e.style === 'dashed' ? `${8 * z} ${6 * z}` : '');

        const tips = arrowTips(raw, pathMode);
        const showStart = arrow === 'start' || arrow === 'both';
        const showEnd = arrow === 'end' || arrow === 'both';

        if (headStart) {
          if (showStart) {
            headStart.setAttribute(
              'd',
              arrowHeadPath(tips.startTip.x, tips.startTip.y, tips.startDir.x, tips.startDir.y, headSize),
            );
            headStart.style.display = '';
          } else {
            headStart.style.display = 'none';
            headStart.removeAttribute('d');
          }
        }
        if (headEnd) {
          if (showEnd) {
            headEnd.setAttribute(
              'd',
              arrowHeadPath(tips.endTip.x, tips.endTip.y, tips.endDir.x, tips.endDir.y, headSize),
            );
            headEnd.style.display = '';
          } else {
            headEnd.style.display = 'none';
            headEnd.removeAttribute('d');
          }
        }
      }

      if (ghostRef.current) {
        if (connecting && nodes[connecting.fromId]) {
          const raw = scaleAnchors(
            anchorsToPoint(
              nodes[connecting.fromId] as CanvasNode,
              connecting.toWorldX,
              connecting.toWorldY,
            ),
            z,
          );
          const inset = insetForArrows(raw, 'end', 'bezier', headSize);
          ghostRef.current.setAttribute('d', pathString(inset, 'bezier'));
          ghostRef.current.style.display = '';
          if (ghostHeadRef.current) {
            const tips = arrowTips(raw, 'bezier');
            ghostHeadRef.current.setAttribute(
              'd',
              arrowHeadPath(tips.endTip.x, tips.endTip.y, tips.endDir.x, tips.endDir.y, headSize),
            );
            ghostHeadRef.current.style.display = '';
          }
        } else {
          ghostRef.current.style.display = 'none';
          if (ghostHeadRef.current) ghostHeadRef.current.style.display = 'none';
        }
      }
    };

    update();

    const unsubNodes = useBoard.subscribe((s) => s.nodes, update);
    const unsubConnecting = useBoard.subscribe((s) => s.connecting, update);
    const unsubZoom = useBoard.subscribe((s) => s.viewport.zoom, update);
    const unsubEdges = useBoard.subscribe((s) => s.edges, update);
    return () => {
      unsubNodes();
      unsubConnecting();
      unsubZoom();
      unsubEdges();
    };
  }, [edgeIds.join(','), nodeIds.join(',')]);

  const edges = useBoard.getState().edges;
  const deleteEdge = useBoard((s) => s.deleteEdge);
  const selectEdge = useBoard((s) => s.selectEdge);

  return (
    <svg
      className="nx-edge-layer"
      width="100000"
      height="100000"
      viewBox="-50000 -50000 100000 100000"
      style={{
        position: 'absolute',
        left: -50000,
        top: -50000,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      {edgeIds.map((id) => {
        const edge = edges[id];
        if (!edge) return null;
        const isSelected = selectedEdgeId === id;
        return (
          <g
            key={id}
            data-edge-id={id}
            className="nx-edge"
            data-selected={isSelected || undefined}
          >
            <path
              className="nx-edge-hit"
              fill="none"
              stroke="transparent"
              strokeWidth={16}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                if (e.shiftKey) {
                  deleteEdge(id);
                } else {
                  selectEdge(id);
                }
              }}
            />
            <path className="nx-edge-line nx-edge-path" fill="none" />
            {/* Drawn heads — independent of SVG marker support */}
            <path className="nx-edge-head nx-edge-head-start" />
            <path className="nx-edge-head nx-edge-head-end" />
          </g>
        );
      })}
      <path
        ref={ghostRef}
        className="nx-edge-path nx-edge-ghost"
        fill="none"
        style={{ display: 'none' }}
      />
      <path
        ref={ghostHeadRef}
        className="nx-edge-head nx-edge-ghost-head"
        style={{ display: 'none' }}
      />
    </svg>
  );
});
