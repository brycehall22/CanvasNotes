// src/canvas/spatial-index.ts
//
// Uniform-grid spatial index for viewport culling.
// NOT wired into the render path in v0.1 — wire it into NodeLayer when
// you start seeing frame drops past ~300 visible nodes.

import type { CanvasNode, Viewport } from '../types/domain';

const CELL = 1000;

export class SpatialIndex {
  private grid = new Map<string, Set<string>>();
  private positions = new Map<string, CanvasNode>();

  private keysFor(n: CanvasNode): string[] {
    const x0 = Math.floor(n.x / CELL);
    const y0 = Math.floor(n.y / CELL);
    const x1 = Math.floor((n.x + n.width) / CELL);
    const y1 = Math.floor((n.y + n.height) / CELL);
    const keys: string[] = [];
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        keys.push(`${cx},${cy}`);
      }
    }
    return keys;
  }

  insert(n: CanvasNode) {
    this.positions.set(n.id, n);
    for (const key of this.keysFor(n)) {
      let bucket = this.grid.get(key);
      if (!bucket) {
        bucket = new Set();
        this.grid.set(key, bucket);
      }
      bucket.add(n.id);
    }
  }

  remove(id: string) {
    const n = this.positions.get(id);
    if (!n) return;
    for (const key of this.keysFor(n)) {
      this.grid.get(key)?.delete(id);
    }
    this.positions.delete(id);
  }

  update(n: CanvasNode) {
    this.remove(n.id);
    this.insert(n);
  }

  query(vp: Viewport, screenW: number, screenH: number): CanvasNode[] {
    const x0 = -vp.x / vp.zoom;
    const y0 = -vp.y / vp.zoom;
    const x1 = x0 + screenW / vp.zoom;
    const y1 = y0 + screenH / vp.zoom;

    const seen = new Set<string>();
    const out: CanvasNode[] = [];

    for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
      for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
        const bucket = this.grid.get(`${cx},${cy}`);
        if (!bucket) continue;
        for (const id of bucket) {
          if (seen.has(id)) continue;
          const n = this.positions.get(id);
          if (!n) continue;
          if (n.x + n.width < x0 || n.x > x1 || n.y + n.height < y0 || n.y > y1) continue;
          seen.add(id);
          out.push(n);
        }
      }
    }
    return out;
  }

  size() { return this.positions.size; }
}
