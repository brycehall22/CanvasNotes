// src/canvas/Stage.tsx
//
// Infinite canvas with pan/zoom. Uses pointer events (not mouse events) and
// pointer capture, which is the modern, bulletproof way to drag — works
// uniformly across mouse, trackpad, pen, and touch.
//
// The pan handler binds to a dedicated background <div> (.nx-canvas-bg)
// that sits below all other content. This avoids the ambiguity of trying
// to filter out node hits via e.target.closest() — node clicks simply
// never reach the background because nodes sit on top in DOM order.

import { useEffect, useRef, useCallback } from 'react';
import { useBoard } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { screenToWorld } from './coords';
import { NodeLayer } from './NodeLayer';
import { EdgeLayer } from './EdgeLayer';
import { OverlayLayer } from './OverlayLayer';

export function Stage() {
  const hostRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const viewport = useBoard((s) => s.viewport);
  const { clearSelection, zoomAt, tool } = useBoard(
    useShallow((s) => ({
      clearSelection: s.clearSelection,
      zoomAt: s.zoomAt,
      tool: s.tool,
    }))
  );

  const setTool = useBoard((s) => s.setTool);

  // Apply viewport: pan via translate only (no CSS scale).
  // Zoom is applied per-node as pixel sizes so text never goes through
  // a scale transform (which is what caused blur and size glitches).
  useEffect(() => {
    // Round to device pixels to avoid sub-pixel antialiasing blur on the whole stage
    const dpr = window.devicePixelRatio || 1;
    const tx = Math.round(viewport.x * dpr) / dpr;
    const ty = Math.round(viewport.y * dpr) / dpr;
    if (stageRef.current) {
      stageRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
    }
    if (gridRef.current) {
      const cell = 24 * viewport.zoom;
      gridRef.current.style.backgroundSize = `${cell}px ${cell}px`;
      gridRef.current.style.backgroundPosition = `${tx}px ${ty}px`;
    }
    if (hostRef.current) {
      hostRef.current.style.setProperty('--nx-z', String(viewport.zoom));
    }
  }, [viewport]);

  // -------- Wheel: zoom (cursor-anchored), or pan with two-finger trackpad --------
  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      // ctrl/cmd + wheel = zoom (also matches trackpad pinch which sets ctrlKey)
      // plain trackpad scroll (no ctrl) with horizontal component = pan
      const isPinch = e.ctrlKey || e.metaKey;
      const isTrackpadPan = !isPinch && Math.abs(e.deltaX) > 0;

      if (isTrackpadPan) {
        useBoard.getState().panBy(-e.deltaX, -e.deltaY);
        return;
      }

      const factor = e.deltaY < 0
        ? (isPinch ? 1.05 : 1.12)
        : (isPinch ? 1 / 1.05 : 1 / 1.12);
      zoomAt(sx, sy, factor);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // -------- Pan: pointerdown on the dedicated bg layer --------
  // Marquee selection rectangle (screen-space)
  const marqueeRef = useRef<HTMLDivElement>(null);

  const onBgPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    e.preventDefault();

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const host = hostRef.current;
    if (!host) return;
    const hostRect = host.getBoundingClientRect();
    const startSX = e.clientX - hostRect.left;
    const startSY = e.clientY - hostRect.top;

    // Default empty-canvas drag = pan (Miro/Figma feel).
    // Shift+drag = marquee selection. Alt/middle/pan-tool also force pan.
    const useMarquee = e.shiftKey && tool !== 'pan' && !e.altKey;
    let mode: 'pan' | 'marquee' = useMarquee ? 'marquee' : 'pan';
    let lastX = e.clientX;
    let lastY = e.clientY;

    if (mode === 'pan') {
      document.body.style.cursor = 'grabbing';
      if (!e.shiftKey) clearSelection();
      useBoard.getState().setEditing(null);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    } else {
      if (!e.shiftKey) clearSelection();
      useBoard.getState().setEditing(null);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;

      if (mode === 'pan') {
        lastX = ev.clientX;
        lastY = ev.clientY;
        useBoard.getState().panBy(dx, dy);
      } else if (mode === 'marquee') {
        const curSX = ev.clientX - hostRect.left;
        const curSY = ev.clientY - hostRect.top;
        const left = Math.min(startSX, curSX);
        const top = Math.min(startSY, curSY);
        const w = Math.abs(curSX - startSX);
        const h = Math.abs(curSY - startSY);
        if (marqueeRef.current) {
          Object.assign(marqueeRef.current.style, {
            display: 'block',
            left: `${left}px`,
            top: `${top}px`,
            width: `${w}px`,
            height: `${h}px`,
          });
        }
      }
    };

    const onUp = (ev: PointerEvent) => {
      try { el.releasePointerCapture(ev.pointerId); } catch {}
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      document.body.style.cursor = '';

      if (mode === 'marquee') {
        const curSX = ev.clientX - hostRect.left;
        const curSY = ev.clientY - hostRect.top;
        const left = Math.min(startSX, curSX);
        const top = Math.min(startSY, curSY);
        const right = Math.max(startSX, curSX);
        const bottom = Math.max(startSY, curSY);
        if (marqueeRef.current) marqueeRef.current.style.display = 'none';

        const vp = useBoard.getState().viewport;
        const wx0 = (left - vp.x) / vp.zoom;
        const wy0 = (top - vp.y) / vp.zoom;
        const wx1 = (right - vp.x) / vp.zoom;
        const wy1 = (bottom - vp.y) / vp.zoom;

        const hits: string[] = [];
        for (const n of Object.values(useBoard.getState().nodes)) {
          if (n.x + n.width < wx0 || n.x > wx1 || n.y + n.height < wy0 || n.y > wy1) continue;
          hits.push(n.id);
        }
        useBoard.getState().selectMany(hits, true);
      }
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }, [clearSelection, tool]);

  // Double-click empty canvas → spawn a text note at that point
  const onBgDoubleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const vp = useBoard.getState().viewport;
    const wx = (e.clientX - rect.left - vp.x) / vp.zoom;
    const wy = (e.clientY - rect.top - vp.y) / vp.zoom;
    const id = useBoard.getState().addNodeAt('text', wx - 120, wy - 40);
    useBoard.getState().select(id);
    useBoard.getState().setEditing(id);
  }, []);

  // -------- Keyboard shortcuts --------
  useEffect(() => {
    let lastMouseClient = { x: 0, y: 0 };
    const trackMouse = (e: MouseEvent) => {
      lastMouseClient = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', trackMouse);

    const onKey = async (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inField = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

      const mod = e.metaKey || e.ctrlKey;

      // Modifier-driven shortcuts: undo / redo / copy / paste / duplicate / select-all
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        if (inField) return;
        e.preventDefault();
        if (e.shiftKey) useBoard.getState().redo();
        else useBoard.getState().undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        if (inField) return;
        e.preventDefault();
        useBoard.getState().redo();
        return;
      }
      if (mod && (e.key === 'c' || e.key === 'C')) {
        if (inField) return;
        e.preventDefault();
        const { copySelection } = await import('../store');
        await copySelection();
        return;
      }
      if (mod && (e.key === 'x' || e.key === 'X')) {
        if (inField) return;
        e.preventDefault();
        const { copySelection } = await import('../store');
        await copySelection();
        useBoard.getState().deleteSelection();
        return;
      }
      if (mod && (e.key === 'v' || e.key === 'V')) {
        if (inField) return;
        e.preventDefault();
        const { readClipboardPayload } = await import('../store');
        const payload = await readClipboardPayload();
        if (!payload) return;
        // Paste at the last known mouse position, converted to world coords
        const host = hostRef.current;
        if (!host) return;
        const rect = host.getBoundingClientRect();
        const vp = useBoard.getState().viewport;
        const worldX = (lastMouseClient.x - rect.left - vp.x) / vp.zoom;
        const worldY = (lastMouseClient.y - rect.top - vp.y) / vp.zoom;
        useBoard.getState().pasteAt(worldX, worldY, payload);
        return;
      }
      if (mod && (e.key === 'a' || e.key === 'A')) {
        if (inField) return;
        e.preventDefault();
        const ids = Object.keys(useBoard.getState().nodes);
        if (ids.length === 0) return;
        useBoard.getState().selectMany(ids);
        return;
      }
      if (mod && (e.key === 'd' || e.key === 'D')) {
        if (inField) return;
        e.preventDefault();
        useBoard.getState().duplicateSelection();
        return;
      }
      if (mod && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('nx:open-search'));
        return;
      }
      if (mod && (e.key === 'g' || e.key === 'G')) {
        if (inField) return;
        e.preventDefault();
        useBoard.getState().frameSelection();
        return;
      }

      // Delete selection when not typing in a field (buttons don't count as typing)
      if ((e.key === 'Backspace' || e.key === 'Delete') && !inField) {
        const st = useBoard.getState();
        if (st.selectedEdgeId) {
          e.preventDefault();
          st.deleteEdge(st.selectedEdgeId);
          return;
        }
        if (st.selectedIds.size > 0) {
          e.preventDefault();
          st.deleteSelection();
        }
        return;
      }

      // Non-modifier shortcuts — skip when typing in a field
      if (inField) return;

      if (e.key === 'v') setTool('select');
      if (e.key === 'c') setTool('connect');
      if (e.key === 'h' || e.key === ' ') {
        if (e.key === 'h') setTool(tool === 'pan' ? 'select' : 'pan');
      }
      if (e.key === 'Escape') {
        useBoard.getState().clearSelection();
        useBoard.getState().setEditing(null);
        setTool('select');
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
      }
      // Arrow-key nudge (Shift = 10×)
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 20 : 4;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        useBoard.getState().nudgeSelection(dx, dy);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousemove', trackMouse);
    };
  }, [setTool, tool]);

  return (
    <div ref={hostRef} className="nx-canvas-host" data-tool={tool}>
      {/* Background catcher: marquee / pan / double-click-to-add */}
      <div
        className="nx-canvas-bg"
        onPointerDown={onBgPointerDown}
        onDoubleClick={onBgDoubleClick}
        aria-hidden="true"
      />
      <div ref={gridRef} className="nx-grid" aria-hidden="true" />
      <div ref={stageRef} className="nx-stage">
        <EdgeLayer />
        <NodeLayer hostRef={hostRef} />
      </div>
      {/* Screen-space marquee box */}
      <div
        ref={marqueeRef}
        className="nx-marquee"
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <OverlayLayer hostRef={hostRef} />
    </div>
  );
}

export function useScreenToWorld(hostRef: React.RefObject<HTMLElement>) {
  return useCallback((clientX: number, clientY: number) => {
    const host = hostRef.current;
    const vp = useBoard.getState().viewport;
    if (!host) return { x: 0, y: 0 };
    const rect = host.getBoundingClientRect();
    return screenToWorld(clientX - rect.left, clientY - rect.top, vp);
  }, [hostRef]);
}
