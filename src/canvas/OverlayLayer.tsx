// src/canvas/OverlayLayer.tsx
//
// Screen-space UI (HUD, zoom controls). Sits outside the transformed
// stage so it doesn't scale with zoom.

import { useBoard } from '../store';
import { useShallow } from 'zustand/react/shallow';

interface Props { hostRef: React.RefObject<HTMLDivElement>; }

export function OverlayLayer({ hostRef }: Props) {
  const { viewport, zoomAt, fitToContent } = useBoard(
    useShallow((s) => ({
      viewport: s.viewport,
      zoomAt: s.zoomAt,
      fitToContent: s.fitToContent,
    }))
  );

  const nodeCount = useBoard((s) => Object.keys(s.nodes).length);

  const zoomByFactor = (factor: number) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    zoomAt(rect.width / 2, rect.height / 2, factor);
  };

  const fit = () => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    fitToContent(rect.width, rect.height);
  };

  return (
    <div className="nx-ui-layer">
      <div className="nx-status">
        {Math.round(viewport.zoom * 100)}%  ·  {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
      </div>
      <div className="nx-hud">
        <button onClick={() => zoomByFactor(1.2)} title="Zoom in" aria-label="Zoom in">+</button>
        <button onClick={() => zoomByFactor(1 / 1.2)} title="Zoom out" aria-label="Zoom out">−</button>
        <button onClick={fit} title="Fit to content" aria-label="Fit to content">◎</button>
      </div>
    </div>
  );
}
