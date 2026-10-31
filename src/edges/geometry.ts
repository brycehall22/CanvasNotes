// src/edges/geometry.ts
//
// Edge endpoint and cubic-bezier math.
//
// Strategy: for each end of an edge, pick the side of the node's bounding
// box that faces the other end most directly (top/right/bottom/left), then
// place the bezier handle perpendicular to that side.

import type { CanvasNode, EdgeArrow } from '../types/domain';

type Side = 'top' | 'right' | 'bottom' | 'left';

export interface EdgeAnchors {
  from: { x: number; y: number };
  to: { x: number; y: number };
  c1: { x: number; y: number };
  c2: { x: number; y: number };
}

function pickSide(
  a: { x: number; y: number; width: number; height: number },
  tx: number,
  ty: number
): Side {
  const acx = a.x + a.width / 2;
  const acy = a.y + a.height / 2;
  const dx = tx - acx;
  const dy = ty - acy;
  const verticallyDominant = Math.abs(dy) * a.width > Math.abs(dx) * a.height;
  if (verticallyDominant) return dy < 0 ? 'top' : 'bottom';
  return dx < 0 ? 'left' : 'right';
}

function anchorOn(
  a: { x: number; y: number; width: number; height: number },
  side: Side
): { point: { x: number; y: number }; out: { x: number; y: number } } {
  const cx = a.x + a.width / 2;
  const cy = a.y + a.height / 2;
  switch (side) {
    case 'top':    return { point: { x: cx,            y: a.y         }, out: { x: 0,  y: -1 } };
    case 'right':  return { point: { x: a.x + a.width, y: cy          }, out: { x: 1,  y:  0 } };
    case 'bottom': return { point: { x: cx,            y: a.y + a.height }, out: { x: 0, y:  1 } };
    case 'left':   return { point: { x: a.x,           y: cy          }, out: { x: -1, y:  0 } };
  }
}

export function anchorsFor(a: CanvasNode, b: CanvasNode): EdgeAnchors {
  const bcx = b.x + b.width / 2;
  const bcy = b.y + b.height / 2;
  const acx = a.x + a.width / 2;
  const acy = a.y + a.height / 2;

  const sideA = pickSide(a, bcx, bcy);
  const sideB = pickSide(b, acx, acy);

  const A = anchorOn(a, sideA);
  const B = anchorOn(b, sideB);

  const dist = Math.hypot(B.point.x - A.point.x, B.point.y - A.point.y);
  const handleLen = Math.max(40, dist * 0.42);

  const c1 = {
    x: A.point.x + A.out.x * handleLen,
    y: A.point.y + A.out.y * handleLen,
  };
  const c2 = {
    x: B.point.x + B.out.x * handleLen,
    y: B.point.y + B.out.y * handleLen,
  };

  return { from: A.point, to: B.point, c1, c2 };
}

export function anchorsToPoint(a: CanvasNode, wx: number, wy: number): EdgeAnchors {
  const sideA = pickSide(a, wx, wy);
  const A = anchorOn(a, sideA);

  const dist = Math.hypot(wx - A.point.x, wy - A.point.y);
  const handleLen = Math.max(40, dist * 0.42);

  const c1 = {
    x: A.point.x + A.out.x * handleLen,
    y: A.point.y + A.out.y * handleLen,
  };
  const dx = A.point.x - wx;
  const dy = A.point.y - wy;
  const len = Math.hypot(dx, dy) || 1;
  const c2 = {
    x: wx + (dx / len) * handleLen,
    y: wy + (dy / len) * handleLen,
  };

  return { from: A.point, to: { x: wx, y: wy }, c1, c2 };
}

export function pathString(a: EdgeAnchors, path: 'bezier' | 'straight' = 'bezier'): string {
  if (path === 'straight') {
    return `M ${a.from.x} ${a.from.y} L ${a.to.x} ${a.to.y}`;
  }
  return `M ${a.from.x} ${a.from.y} C ${a.c1.x} ${a.c1.y}, ${a.c2.x} ${a.c2.y}, ${a.to.x} ${a.to.y}`;
}

function norm(dx: number, dy: number): { x: number; y: number } {
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

/** World-unit length of an arrowhead (before zoom). */
export const ARROW_SIZE = 14;

/**
 * Pull endpoints inward along the path so arrowheads sit in the gap
 * between nodes instead of under node chrome.
 */
export function insetForArrows(
  a: EdgeAnchors,
  arrow: EdgeArrow | undefined,
  path: 'bezier' | 'straight' = 'bezier',
  size = ARROW_SIZE,
): EdgeAnchors {
  const showStart = arrow === 'start' || arrow === 'both';
  const showEnd = arrow === 'end' || arrow === 'both' || arrow === undefined;
  // default arrow is 'end' when undefined
  const end = arrow === undefined ? true : showEnd;
  const start = showStart;

  if (!start && !end) return a;

  let from = a.from;
  let to = a.to;

  if (path === 'straight') {
    const d = norm(to.x - from.x, to.y - from.y);
    if (start) from = { x: from.x + d.x * size, y: from.y + d.y * size };
    if (end)   to   = { x: to.x   - d.x * size, y: to.y   - d.y * size };
  } else {
    if (start) {
      const d = norm(a.c1.x - a.from.x, a.c1.y - a.from.y);
      from = { x: a.from.x + d.x * size, y: a.from.y + d.y * size };
    }
    if (end) {
      // step back from `to` toward c2
      const d = norm(a.to.x - a.c2.x, a.to.y - a.c2.y);
      to = { x: a.to.x - d.x * size, y: a.to.y - d.y * size };
    }
  }

  return { from, to, c1: a.c1, c2: a.c2 };
}

/**
 * Filled triangle for an arrowhead.
 * `tip` is the pointy end; direction is the unit vector the tip points along.
 */
export function arrowHeadPath(
  tipX: number,
  tipY: number,
  dirX: number,
  dirY: number,
  size = ARROW_SIZE,
): string {
  const d = norm(dirX, dirY);
  // Base center sits behind the tip
  const bx = tipX - d.x * size;
  const by = tipY - d.y * size;
  // Perpendicular for wing width (~0.55 of length)
  const px = -d.y * size * 0.55;
  const py =  d.x * size * 0.55;
  const x1 = bx + px;
  const y1 = by + py;
  const x2 = bx - px;
  const y2 = by - py;
  return `M ${tipX} ${tipY} L ${x1} ${y1} L ${x2} ${y2} Z`;
}

/** Tip + direction for start/end heads from raw (non-inset) anchors. */
export function arrowTips(
  a: EdgeAnchors,
  path: 'bezier' | 'straight' = 'bezier',
): {
  startTip: { x: number; y: number };
  startDir: { x: number; y: number };
  endTip: { x: number; y: number };
  endDir: { x: number; y: number };
} {
  if (path === 'straight') {
    const d = norm(a.to.x - a.from.x, a.to.y - a.from.y);
    return {
      startTip: a.from,
      // start head points outward = opposite path direction
      startDir: { x: -d.x, y: -d.y },
      endTip: a.to,
      endDir: d,
    };
  }
  const startAlong = norm(a.c1.x - a.from.x, a.c1.y - a.from.y);
  const endAlong = norm(a.to.x - a.c2.x, a.to.y - a.c2.y);
  return {
    startTip: a.from,
    startDir: { x: -startAlong.x, y: -startAlong.y },
    endTip: a.to,
    endDir: endAlong,
  };
}
