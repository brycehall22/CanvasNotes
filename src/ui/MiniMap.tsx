// Collapsible minimap — overview of nodes + viewport rectangle.

import { useEffect, useRef, useState } from 'react';
import { useBoard } from '../store';

const W = 180;
const H = 120;
const PAD = 24;

export function MiniMap({ hostRef }: { hostRef: React.RefObject<HTMLDivElement> }) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodes = useBoard((s) => s.nodes);
  const viewport = useBoard((s) => s.viewport);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const list = Object.values(nodes);
    let minX = 0, minY = 0, maxX = 800, maxY = 600;
    if (list.length) {
      minX = Math.min(...list.map((n) => n.x));
      minY = Math.min(...list.map((n) => n.y));
      maxX = Math.max(...list.map((n) => n.x + n.width));
      maxY = Math.max(...list.map((n) => n.y + n.height));
    }
    // Include current viewport in bounds
    const host = hostRef.current;
    const sw = host?.clientWidth || 1200;
    const sh = host?.clientHeight || 800;
    const z = viewport.zoom || 1;
    const viewWorldX = -viewport.x / z;
    const viewWorldY = -viewport.y / z;
    const viewWorldW = sw / z;
    const viewWorldH = sh / z;
    minX = Math.min(minX, viewWorldX);
    minY = Math.min(minY, viewWorldY);
    maxX = Math.max(maxX, viewWorldX + viewWorldW);
    maxY = Math.max(maxY, viewWorldY + viewWorldH);

    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const scale = Math.min((W - PAD * 2) / bw, (H - PAD * 2) / bh);

    const toMap = (x: number, y: number) => ({
      x: PAD + (x - minX) * scale,
      y: PAD + (y - minY) * scale,
    });

    // Background
    ctx.clearRect(0, 0, W, H);
    const style = getComputedStyle(document.documentElement);
    const bg = style.getPropertyValue('--nx-surface-raised').trim() || '#1a1a1a';
    const accent = style.getPropertyValue('--nx-accent').trim() || '#6b9';
    const nodeFill = style.getPropertyValue('--nx-text-tertiary').trim() || '#888';

    ctx.fillStyle = bg;
    ctx.globalAlpha = 0.35;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;

    // Nodes
    for (const n of list) {
      const p = toMap(n.x, n.y);
      const w = Math.max(2, n.width * scale);
      const h = Math.max(2, n.height * scale);
      ctx.fillStyle = n.kind === 'frame' ? accent : nodeFill;
      ctx.globalAlpha = n.kind === 'frame' ? 0.25 : 0.55;
      ctx.fillRect(p.x, p.y, w, h);
    }
    ctx.globalAlpha = 1;

    // Viewport rect
    const vp = toMap(viewWorldX, viewWorldY);
    const vw = viewWorldW * scale;
    const vh = viewWorldH * scale;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vp.x, vp.y, vw, vh);
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.12;
    ctx.fillRect(vp.x, vp.y, vw, vh);
    ctx.globalAlpha = 1;
  }, [open, nodes, viewport, hostRef]);

  const onMapClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const list = Object.values(useBoard.getState().nodes);
    let minX = 0, minY = 0, maxX = 800, maxY = 600;
    if (list.length) {
      minX = Math.min(...list.map((n) => n.x));
      minY = Math.min(...list.map((n) => n.y));
      maxX = Math.max(...list.map((n) => n.x + n.width));
      maxY = Math.max(...list.map((n) => n.y + n.height));
    }
    const st = useBoard.getState();
    const z = st.viewport.zoom || 1;
    const sw = host.clientWidth;
    const sh = host.clientHeight;
    const viewWorldX = -st.viewport.x / z;
    const viewWorldY = -st.viewport.y / z;
    const viewWorldW = sw / z;
    const viewWorldH = sh / z;
    minX = Math.min(minX, viewWorldX);
    minY = Math.min(minY, viewWorldY);
    maxX = Math.max(maxX, viewWorldX + viewWorldW);
    maxY = Math.max(maxY, viewWorldY + viewWorldH);
    const bw = maxX - minX || 1;
    const bh = maxY - minY || 1;
    const scale = Math.min((W - PAD * 2) / bw, (H - PAD * 2) / bh);

    const worldX = minX + (mx - PAD) / scale;
    const worldY = minY + (my - PAD) / scale;
    // Center viewport on click
    st.setViewport({
      ...st.viewport,
      x: sw / 2 - worldX * z,
      y: sh / 2 - worldY * z,
    });
  };

  if (!open) {
    return (
      <div className="nx-minimap collapsed" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="nx-minimap-pill" onClick={() => setOpen(true)} title="Show minimap">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <rect x="7" y="7" width="5" height="4" />
            <rect x="14" y="12" width="4" height="5" />
          </svg>
          Map
        </button>
      </div>
    );
  }

  return (
    <div className="nx-minimap" onPointerDown={(e) => e.stopPropagation()}>
      <div className="nx-minimap-header">
        <span>Overview</span>
        <button type="button" onClick={() => setOpen(false)} title="Collapse" aria-label="Collapse minimap">
          −
        </button>
      </div>
      <canvas
        ref={canvasRef}
        className="nx-minimap-canvas"
        width={W}
        height={H}
        onClick={onMapClick}
      />
    </div>
  );
}
