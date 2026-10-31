// src/canvas/coords.ts
//
// The two functions every canvas engine needs.
// Keep them pure. Route every screen <-> world conversion through here.

import type { Viewport } from '../types/domain';

export const screenToWorld = (sx: number, sy: number, vp: Viewport) => ({
  x: (sx - vp.x) / vp.zoom,
  y: (sy - vp.y) / vp.zoom,
});

export const worldToScreen = (wx: number, wy: number, vp: Viewport) => ({
  x: wx * vp.zoom + vp.x,
  y: wy * vp.zoom + vp.y,
});

export const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/**
 * Zoom while keeping the world point under (screenX, screenY) pinned.
 */
export function zoomedAt(
  vp: Viewport,
  screenX: number,
  screenY: number,
  factor: number,
  bounds: [number, number] = [0.25, 3]
): Viewport {
  // Quantize zoom slightly so width/height land on stable pixel sizes
  const newZoom = Math.round(clamp(vp.zoom * factor, bounds[0], bounds[1]) * 1000) / 1000;
  const world = screenToWorld(screenX, screenY, vp);
  return {
    zoom: newZoom,
    x: screenX - world.x * newZoom,
    y: screenY - world.y * newZoom,
  };
}

/**
 * Return viewport that frames the given world bounding box with padding.
 */
export function fitBounds(
  box: { x: number; y: number; width: number; height: number },
  screenW: number,
  screenH: number,
  padding = 60
): Viewport {
  const zoomX = (screenW - padding * 2) / Math.max(box.width, 1);
  const zoomY = (screenH - padding * 2) / Math.max(box.height, 1);
  const zoom = clamp(Math.min(zoomX, zoomY), 0.25, 3);
  return {
    zoom,
    x: padding - box.x * zoom + (screenW - padding * 2 - box.width * zoom) / 2,
    y: padding - box.y * zoom + (screenH - padding * 2 - box.height * zoom) / 2,
  };
}
