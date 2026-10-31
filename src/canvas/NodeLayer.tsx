// src/canvas/NodeLayer.tsx
//
// Renders visible nodes with viewport culling via the spatial index.
// Each node is an absolutely positioned component inside the transformed
// stage, so pan/zoom is free — no per-node math at render time.

import { memo, useEffect, useMemo, useState } from 'react';
import { useBoard } from '../store';
import { NodeShape } from '../nodes/NodeShape';
import { SpatialIndex } from './spatial-index';

interface Props { hostRef: React.RefObject<HTMLDivElement>; }

// Cull when we have enough nodes that off-screen work would matter
const CULL_THRESHOLD = 80;

export const NodeLayer = memo(function NodeLayer({ hostRef }: Props) {
  // Structural subscription — only re-render when the set of ids changes
  const nodeIds = useBoard((s) => Object.keys(s.nodes));
  const viewport = useBoard((s) => s.viewport);

  // Rebuild spatial index when node set changes (positions updated on move)
  const index = useMemo(() => {
    const idx = new SpatialIndex();
    const nodes = useBoard.getState().nodes;
    for (const id of nodeIds) {
      const n = nodes[id];
      if (n) idx.insert(n);
    }
    return idx;
  }, [nodeIds]);

  // Keep index positions in sync during drag without rebuilding from scratch
  useEffect(() => {
    return useBoard.subscribe(
      (s) => s.nodes,
      (nodes) => {
        for (const id of Object.keys(nodes)) {
          const n = nodes[id];
          if (n) index.update(n);
        }
      }
    );
  }, [index]);

  const [screenSize, setScreenSize] = useState({ w: 1920, h: 1080 });
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) setScreenSize({ w: r.width, h: r.height });
    });
    ro.observe(host);
    setScreenSize({ w: host.clientWidth, h: host.clientHeight });
    return () => ro.disconnect();
  }, [hostRef]);

  const visibleIds = useMemo(() => {
    if (nodeIds.length < CULL_THRESHOLD) return nodeIds;
    // Refresh positions from store before query
    const nodes = useBoard.getState().nodes;
    for (const id of nodeIds) {
      const n = nodes[id];
      if (n) index.update(n);
    }
    const visible = index.query(viewport, screenSize.w, screenSize.h);
    // Always include selected / editing so they never vanish mid-interaction
    const s = useBoard.getState();
    const mustShow = new Set([...s.selectedIds, s.editingNodeId].filter(Boolean) as string[]);
    const ids = new Set(visible.map((n) => n.id));
    for (const id of mustShow) ids.add(id);
    return Array.from(ids);
  }, [nodeIds, viewport, screenSize, index]);

  // Stable paint order: frames (low zIndex) under content cards
  const orderedIds = useMemo(() => {
    const nodes = useBoard.getState().nodes;
    return [...visibleIds].sort((a, b) => {
      const za = nodes[a]?.zIndex ?? 0;
      const zb = nodes[b]?.zIndex ?? 0;
      if (za !== zb) return za - zb;
      return a.localeCompare(b);
    });
  }, [visibleIds]);

  return (
    <div className="nx-node-layer">
      {orderedIds.map((id) => (
        <NodeShape key={id} id={id} hostRef={hostRef} />
      ))}
    </div>
  );
});
