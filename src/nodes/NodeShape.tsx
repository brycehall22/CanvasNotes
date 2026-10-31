// src/nodes/NodeShape.tsx
//
// Shared wrapper for any node kind: drag, resize, selection, connection port.
//
// Display model (no CSS scale on the stage):
//   left/top/width/height are painted in *screen pixels* =
//   world value × viewport.zoom. Text is therefore rendered at its final
//   pixel size by the browser — never upscaled from a bitmap — so it stays sharp.

import { memo, useCallback, useRef, useState } from 'react';
import { useBoard } from '../store';
import { useShallow } from 'zustand/react/shallow';
import { screenToWorld } from '../canvas/coords';
import { TextNodeContent } from './text/TextNode';
import { StickyNodeContent } from './sticky/StickyNode';
import { TodoNodeContent } from './todo/TodoNode';
import { FrameNodeContent } from './frame/FrameNode';
import { ShapeNodeContent } from './shape/ShapeNode';
import { ImageNodeContent } from './image/ImageNode';
import { VideoNodeContent } from './video/VideoNode';
import { LinkNodeContent } from './link/LinkNode';
import { nodeCenterInFrame } from '../types/domain';

interface Props { id: string; hostRef: React.RefObject<HTMLDivElement>; }

export const NodeShape = memo(function NodeShape({ id, hostRef }: Props) {
  const node = useBoard((s) => s.nodes[id]);
  const zoom = useBoard((s) => s.viewport.zoom);

  const { isSelected, isHovered, isEditing, isConnecting } = useBoard(
    useShallow((s) => ({
      isSelected: s.selectedIds.has(id),
      isHovered: s.hoveredId === id,
      isEditing: s.editingNodeId === id,
      isConnecting: !!s.connecting,
    }))
  );

  const nodeRef = useRef<HTMLDivElement>(null);
  const [draggingVisual, setDraggingVisual] = useState(false);

  // ---------- SELECT + DRAG ----------
  // Selection always runs on pointer-down anywhere on the node (so Delete works
  // even when the click lands on a checkbox/input). Drag only starts when the
  // target is not an interactive control.
  const onDragPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const target = e.target as HTMLElement;
    if (target.closest('.nx-port')) return;
    if (target.closest('.nx-resize')) return;

    // Never let the event fall through to canvas pan
    e.stopPropagation();

    // --- Selection (always) ---
    const before = useBoard.getState();
    if (!before.selectedIds.has(id)) {
      before.select(id, e.shiftKey);
    } else if (e.shiftKey) {
      before.select(id, true);
    }

    const interactive = !!target.closest(
      'input,textarea,button,a,label,.nx-no-drag,.nx-video-active,' +
      '.nx-text-editor,.nx-sticky-editor,.nx-todo-title-input,.nx-frame-title-input'
    );
    // Interactive target: select only, leave focus/click to the control
    if (interactive) return;

    // --- Drag ---
    const store = useBoard.getState(); // fresh state after select()
    const n = store.nodes[id];
    if (!n) return;

    let dragIds = store.selectedIds.has(id)
      ? Array.from(store.selectedIds)
      : [id];

    // When dragging frames, also move non-frame nodes whose centers are inside
    const members = new Set<string>();
    for (const fid of dragIds) {
      const f = store.nodes[fid];
      if (!f || f.kind !== 'frame') continue;
      for (const [nid, other] of Object.entries(store.nodes)) {
        if (other.kind === 'frame' || members.has(nid) || dragIds.includes(nid)) continue;
        if (nodeCenterInFrame(other, f)) members.add(nid);
      }
    }
    if (members.size) dragIds = [...dragIds, ...members];

    const startX = e.clientX;
    const startY = e.clientY;
    let lastDx = 0;
    let lastDy = 0;
    let moved = false;

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const z = useBoard.getState().viewport.zoom;
      const dx = (ev.clientX - startX) / z;
      const dy = (ev.clientY - startY) / z;
      if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
        moved = true;
        useBoard.getState().commit();
        ev.preventDefault();
        setDraggingVisual(true);
      }
      if (moved) {
        const stepX = dx - lastDx;
        const stepY = dy - lastDy;
        lastDx = dx;
        lastDy = dy;
        if (stepX !== 0 || stepY !== 0) {
          useBoard.getState().moveNodesBy(dragIds, stepX, stepY);
        }
      }
    };

    const onUp = (ev: PointerEvent) => {
      try { el.releasePointerCapture(ev.pointerId); } catch { /* */ }
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      setDraggingVisual(false);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }, [id]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    useBoard.getState().setEditing(id);
  }, [id]);

  // ---------- CONNECTION PORT ----------
  const onPortPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const store = useBoard.getState();
    const n = store.nodes[id];
    if (!n) return;

    const anchorX = n.x + n.width;
    const anchorY = n.y + n.height / 2;
    store.startConnection(id, anchorX, anchorY);

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);
    const host = hostRef.current;

    const onMove = (ev: PointerEvent) => {
      if (!host) return;
      const rect = host.getBoundingClientRect();
      const vp = useBoard.getState().viewport;
      const world = screenToWorld(ev.clientX - rect.left, ev.clientY - rect.top, vp);
      useBoard.getState().updateConnection(world.x, world.y);
    };

    const onUp = (ev: PointerEvent) => {
      try { el.releasePointerCapture(ev.pointerId); } catch { /* */ }
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);

      // Hit-test: which node is under the pointer?
      let toId: string | null = null;
      if (host) {
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        const nodeEl = under?.closest?.('[data-node-id]') as HTMLElement | null;
        if (nodeEl) toId = nodeEl.dataset.nodeId || null;
      }
      useBoard.getState().endConnection(toId);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }, [id, hostRef]);

  // ---------- RESIZE ----------
  const onResizePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const n = useBoard.getState().nodes[id];
    if (!n) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startW = n.width;
    const startH = n.height;
    let moved = false;

    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const onMove = (ev: PointerEvent) => {
      const z = useBoard.getState().viewport.zoom;
      const dw = (ev.clientX - startX) / z;
      const dh = (ev.clientY - startY) / z;
      if (!moved && (Math.abs(dw) > 2 || Math.abs(dh) > 2)) {
        moved = true;
        useBoard.getState().commit();
      }
      if (moved) {
        useBoard.getState().resizeNode(id, startW + dw, startH + dh);
      }
    };

    const onUp = (ev: PointerEvent) => {
      try { el.releasePointerCapture(ev.pointerId); } catch { /* */ }
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };

    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  }, [id]);

  const onMouseEnter = () => useBoard.getState().setHover(id);
  const onMouseLeave = () => useBoard.getState().setHover(null);

  if (!node) return null;

  const color = node.color || 'default';
  const frameCollapsed = node.kind === 'frame' && !!(node as { collapsed?: boolean }).collapsed;
  const frameZoomedOut = node.kind === 'frame' && zoom < 0.45;
  const classes = [
    'nx-node',
    `nx-node-${node.kind}`,
    `nx-color-${color}`,
    isSelected ? 'nx-selected' : '',
    isEditing ? 'nx-editing' : '',
    isHovered ? 'nx-hovered' : '',
    draggingVisual ? 'nx-dragging' : '',
    isConnecting ? 'nx-connect-target' : '',
    frameCollapsed ? 'nx-frame-collapsed' : '',
    frameZoomedOut ? 'nx-frame-zoomed-out' : '',
  ].filter(Boolean).join(' ');

  // Paint in screen pixels — no CSS scale involved, so text stays sharp.
  const z = zoom;
  // Integer screen pixels — avoids sub-pixel layout shift / content offset
  const left = Math.round(node.x * z);
  const top = Math.round(node.y * z);
  const width = Math.max(1, Math.round(node.width * z));
  // Zoomed-out frames collapse visually to a title strip (data height unchanged)
  const paintH =
    node.kind === 'frame' && zoom < 0.45 && !(node as { collapsed?: boolean }).collapsed
      ? Math.min(node.height, 44)
      : node.height;
  const height = Math.max(1, Math.round(paintH * z));

  return (
    <div
      ref={nodeRef}
      className={classes}
      data-node-id={id}
      style={{
        left,
        top,
        width,
        height,
        zIndex: node.zIndex,
        // Drive proportional typography without transform:scale
        ['--nx-z' as string]: z,
      }}
      onPointerDown={onDragPointerDown}
      onDoubleClick={onDoubleClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="nx-node-body">
        {node.kind === 'text'   && <TextNodeContent id={id} />}
        {node.kind === 'sticky' && <StickyNodeContent id={id} />}
        {node.kind === 'todo'   && <TodoNodeContent id={id} />}
        {node.kind === 'shape'  && <ShapeNodeContent id={id} />}
        {node.kind === 'frame'  && <FrameNodeContent id={id} />}
        {node.kind === 'image'  && <ImageNodeContent id={id} />}
        {node.kind === 'video'  && <VideoNodeContent id={id} />}
        {node.kind === 'link'   && <LinkNodeContent id={id} />}
      </div>
      {node.kind !== 'frame' && (
        <div
          className="nx-port"
          onPointerDown={onPortPointerDown}
          title="Drag to another node to connect"
          aria-label="Connection port"
        />
      )}
      <div
        className="nx-resize"
        onPointerDown={onResizePointerDown}
        aria-label="Resize"
      />
    </div>
  );
});
