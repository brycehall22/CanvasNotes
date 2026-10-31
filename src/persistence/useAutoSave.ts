// src/persistence/useAutoSave.ts
// Subscribes to store changes and writes debounced snapshots to IndexedDB.

import { useEffect, useRef } from 'react';
import { useBoard } from '../store';
import { saveBoardSnapshot } from './indexeddb';

const DEBOUNCE_MS = 400;

export function useAutoSave() {
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const schedule = () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(flush, DEBOUNCE_MS);
    };

    const flush = async () => {
      const s = useBoard.getState();
      if (!s.boardId) return;
      try {
        await saveBoardSnapshot(
          s.boardId,
          Object.values(s.nodes),
          Object.values(s.edges),
          s.viewport
        );
      } catch (err) {
        console.error('[nexuscanvas] auto-save failed', err);
      }
    };

    // Subscribe to any change in persistent data or viewport
    const unsubNodes = useBoard.subscribe((s) => s.nodes, schedule);
    const unsubEdges = useBoard.subscribe((s) => s.edges, schedule);
    const unsubViewport = useBoard.subscribe((s) => s.viewport, schedule);

    // Flush on unmount / tab close
    const onBeforeUnload = () => { flush(); };
    window.addEventListener('beforeunload', onBeforeUnload);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
      unsubNodes();
      unsubEdges();
      unsubViewport();
      window.removeEventListener('beforeunload', onBeforeUnload);
      flush();
    };
  }, []);
}
