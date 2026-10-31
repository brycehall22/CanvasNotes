// src/store/index.ts
//
// Single Zustand store. Slices: nodes, edges, viewport, selection, history.
//
// HISTORY MODEL: snapshot-based, not patch-based. Each commit() captures
// the current { nodes, edges } and pushes it onto a `past` stack. Undo
// restores the most recent snapshot from `past` and pushes the current
// state onto `future`. Redo is the reverse.
//
// This is simpler and more robust than patch tracking, at the cost of
// memory (each snapshot is full nodes+edges). For the rough draft scale
// (hundreds of nodes), this is fine — boards rarely exceed a few KB JSON.
//
// COMMIT BOUNDARIES: we commit BEFORE the action runs (capturing the
// pre-action state). Drags commit once at the start; pixel-by-pixel
// movement during the drag does NOT commit. Add/delete/paste commit
// before each.

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';
import { enableMapSet } from 'immer';
import { nanoid } from 'nanoid';
import type { CanvasNode, Edge, Viewport, NodeKind, NodeColor, ShapeType, EdgeArrow, EdgePath } from '../types/domain';
import { SHAPE_TYPES, nodeTitle } from '../types/domain';
import { zoomedAt, fitBounds } from '../canvas/coords';

enableMapSet();

type Tool = 'select' | 'connect' | 'pan';

const HISTORY_LIMIT = 80;

interface Snapshot {
  nodes: Record<string, CanvasNode>;
  edges: Record<string, Edge>;
}

interface BoardState {
  // -- Data --
  boardId: string | null;
  nodes: Record<string, CanvasNode>;
  edges: Record<string, Edge>;
  edgesByNode: Record<string, string[]>;
  viewport: Viewport;

  // -- Ephemeral UI --
  selectedIds: Set<string>;
  selectedEdgeId: string | null;
  hoveredId: string | null;
  tool: Tool;
  editingNodeId: string | null;

  // -- Connection gesture --
  connecting: { fromId: string; toWorldX: number; toWorldY: number } | null;

  // -- History --
  past: Snapshot[];
  future: Snapshot[];

  // -- Lifecycle --
  loadBoard: (boardId: string, data: { nodes: CanvasNode[]; edges: Edge[]; viewport: Viewport }) => void;
  resetBoard: () => void;

  // -- History actions --
  commit: () => void;             // Snapshot current state to past stack
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // -- Node actions --
  addNodeAt: (kind: NodeKind, worldX: number, worldY: number, overrides?: Partial<CanvasNode>) => string;
  addNode: (node: CanvasNode) => void;
  moveNode: (id: string, x: number, y: number) => void;
  /** Move multiple nodes by the same delta (group drag). No history commit. */
  moveNodesBy: (ids: string[], dx: number, dy: number) => void;
  resizeNode: (id: string, width: number, height: number) => void;
  updateNode: (id: string, patch: Partial<CanvasNode>) => void;
  /** Set color on all selected nodes. Commits once. */
  setSelectionColor: (color: NodeColor) => void;
  deleteNode: (id: string) => void;
  deleteSelection: () => void;
  /** Nudge selected nodes by (dx, dy) world units. Commits once. */
  nudgeSelection: (dx: number, dy: number) => void;
  /** Raise selected nodes above everything else. */
  bringSelectionToFront: () => void;
  /** Create a frame around the current selection (or empty frame at center). */
  frameSelection: () => string;
  /** Select a node and pan/zoom so it is centered on screen. */
  focusNode: (id: string, screenW: number, screenH: number) => void;

  // -- Edge actions --
  addEdge: (from: string, to: string) => void;
  deleteEdge: (id: string) => void;
  selectEdge: (id: string | null) => void;
  updateEdge: (id: string, patch: Partial<Pick<Edge, 'style' | 'arrow' | 'path' | 'label'>>) => void;

  // -- Shape helpers --
  setSelectionShape: (shape: ShapeType) => void;
  toggleFrameCollapse: (id: string) => void;
  /** Resolve a wiki title to a node id (exact title match, case-insensitive) */
  findNodeByTitle: (title: string) => string | null;
  /** Ensure a wiki edge from → to exists */
  ensureWikiEdge: (fromId: string, toId: string) => void;

  // -- Clipboard / duplicate --
  duplicateSelection: () => void;
  pasteAt: (worldX: number, worldY: number, payload: ClipboardPayload) => void;

  // -- Viewport --
  setViewport: (vp: Viewport) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (screenX: number, screenY: number, factor: number) => void;
  fitToContent: (screenW: number, screenH: number) => void;

  // -- Tool / selection --
  setTool: (tool: Tool) => void;
  select: (id: string, additive?: boolean) => void;
  selectMany: (ids: string[], additive?: boolean) => void;
  clearSelection: () => void;
  setHover: (id: string | null) => void;
  setEditing: (id: string | null) => void;

  // -- Connection gesture --
  startConnection: (fromId: string, wx: number, wy: number) => void;
  updateConnection: (wx: number, wy: number) => void;
  endConnection: (toId: string | null) => void;
}

export interface ClipboardPayload {
  kind: 'nexuscanvas:v1';
  nodes: CanvasNode[];
  edges: Edge[];
  // Origin used to compute relative offsets when pasting at a new position
  originX: number;
  originY: number;
}

function rebuildIndex(edges: Record<string, Edge>): Record<string, string[]> {
  const idx: Record<string, string[]> = {};
  for (const e of Object.values(edges)) {
    (idx[e.from] ||= []).push(e.id);
    (idx[e.to] ||= []).push(e.id);
  }
  return idx;
}

function snapshotOf(state: { nodes: Record<string, CanvasNode>; edges: Record<string, Edge> }): Snapshot {
  // deep clone via JSON — node payloads are plain data, so this is safe and fast
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)),
    edges: JSON.parse(JSON.stringify(state.edges)),
  };
}

const defaultSize = (kind: NodeKind): { width: number; height: number } => {
  switch (kind) {
    case 'text':   return { width: 240, height: 120 };
    case 'sticky': return { width: 180, height: 160 };
    case 'todo':   return { width: 220, height: 180 };
    case 'shape':  return { width: 160, height: 100 };
    case 'frame':  return { width: 480, height: 360 };
    case 'image':  return { width: 240, height: 180 };
    case 'video':  return { width: 280, height: 180 };
    case 'link':   return { width: 260, height: 130 };
  }
};

function makeNode(kind: NodeKind, boardId: string, x: number, y: number, overrides?: Partial<CanvasNode>): CanvasNode {
  const { width, height } = defaultSize(kind);
  const base = {
    id: nanoid(10),
    boardId,
    x, y, width, height,
    zIndex: 0,
    color: 'default' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  switch (kind) {
    case 'text':
      return { ...base, kind: 'text', markdown: '# New note\n\nType your thoughts here…', ...overrides } as CanvasNode;
    case 'sticky':
      return { ...base, kind: 'sticky', text: '', color: 'yellow', ...overrides } as CanvasNode;
    case 'todo':
      return {
        ...base,
        kind: 'todo',
        title: 'Checklist',
        items: [
          { id: nanoid(8), text: 'First item', done: false },
          { id: nanoid(8), text: 'Second item', done: false },
        ],
        ...overrides,
      } as CanvasNode;
    case 'shape':
      return { ...base, kind: 'shape', shape: 'rounded', text: 'Shape', ...overrides } as CanvasNode;
    case 'frame':
      return { ...base, kind: 'frame', title: 'Frame', zIndex: -1, color: 'default', ...overrides } as CanvasNode;
    case 'image':
      return { ...base, kind: 'image', assetId: '', alt: '', ...overrides } as CanvasNode;
    case 'video':
      return { ...base, kind: 'video', provider: 'youtube', videoId: '', ...overrides } as CanvasNode;
    case 'link':
      return { ...base, kind: 'link', url: '', ...overrides } as CanvasNode;
  }
}

export const useBoard = create<BoardState>()(
  subscribeWithSelector(
    immer((set, get) => ({
      boardId: null,
      nodes: {},
      edges: {},
      edgesByNode: {},
      viewport: { x: 0, y: 0, zoom: 1 },
      selectedIds: new Set(),
      selectedEdgeId: null,
      hoveredId: null,
      tool: 'select',
      editingNodeId: null,
      connecting: null,
      past: [],
      future: [],

      loadBoard: (boardId, data) => set((s) => {
        s.boardId = boardId;
        s.nodes = {};
        s.edges = {};
        for (const n of data.nodes) s.nodes[n.id] = n;
        for (const e of data.edges) s.edges[e.id] = e;
        s.edgesByNode = rebuildIndex(s.edges);
        s.viewport = data.viewport;
        s.selectedIds = new Set();
        s.selectedEdgeId = null;
        s.hoveredId = null;
        s.editingNodeId = null;
        s.connecting = null;
        s.past = [];
        s.future = [];
      }),

      resetBoard: () => set((s) => {
        s.boardId = null;
        s.nodes = {};
        s.edges = {};
        s.edgesByNode = {};
        s.viewport = { x: 0, y: 0, zoom: 1 };
        s.selectedIds = new Set();
        s.selectedEdgeId = null;
        s.past = [];
        s.future = [];
      }),

      // ------------- HISTORY -------------

      commit: () => set((s) => {
        const snap = snapshotOf({ nodes: s.nodes, edges: s.edges });
        s.past.push(snap);
        if (s.past.length > HISTORY_LIMIT) s.past.shift();
        s.future = []; // any new action invalidates redo
      }),

      undo: () => set((s) => {
        if (s.past.length === 0) return;
        const present = snapshotOf({ nodes: s.nodes, edges: s.edges });
        s.future.push(present);
        const restored = s.past.pop()!;
        s.nodes = restored.nodes;
        s.edges = restored.edges;
        s.edgesByNode = rebuildIndex(s.edges);
        // Drop selection of nodes that no longer exist
        for (const id of Array.from(s.selectedIds)) {
          if (!s.nodes[id]) s.selectedIds.delete(id);
        }
        s.editingNodeId = null;
      }),

      redo: () => set((s) => {
        if (s.future.length === 0) return;
        const present = snapshotOf({ nodes: s.nodes, edges: s.edges });
        s.past.push(present);
        const restored = s.future.pop()!;
        s.nodes = restored.nodes;
        s.edges = restored.edges;
        s.edgesByNode = rebuildIndex(s.edges);
        for (const id of Array.from(s.selectedIds)) {
          if (!s.nodes[id]) s.selectedIds.delete(id);
        }
        s.editingNodeId = null;
      }),

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,

      // ------------- NODES -------------

      addNodeAt: (kind, wx, wy, overrides) => {
        const boardId = get().boardId;
        if (!boardId) return '';
        get().commit();
        const node = makeNode(kind, boardId, wx, wy, overrides);
        set((s) => { s.nodes[node.id] = node; });
        return node.id;
      },

      addNode: (node) => {
        get().commit();
        set((s) => { s.nodes[node.id] = node; });
      },

      // moveNode is called many times during drag. We do NOT commit here —
      // callers (NodeShape.tsx) commit once before the drag starts.
      moveNode: (id, x, y) => set((s) => {
        const n = s.nodes[id];
        if (!n) return;
        n.x = x; n.y = y; n.updatedAt = Date.now();
      }),

      // Batch move for group-drag. Same no-commit policy as moveNode.
      moveNodesBy: (ids, dx, dy) => {
        if (dx === 0 && dy === 0) return;
        set((s) => {
          const now = Date.now();
          for (const id of ids) {
            const n = s.nodes[id];
            if (!n) continue;
            n.x += dx;
            n.y += dy;
            n.updatedAt = now;
          }
        });
      },

      // Same: resize commits at the gesture boundary, not per-pixel.
      resizeNode: (id, width, height) => set((s) => {
        const n = s.nodes[id];
        if (!n) return;
        n.width = Math.max(80, width);
        n.height = Math.max(60, height);
        n.updatedAt = Date.now();
      }),

      nudgeSelection: (dx, dy) => {
        const ids = Array.from(get().selectedIds);
        if (ids.length === 0 || (dx === 0 && dy === 0)) return;
        get().commit();
        get().moveNodesBy(ids, dx, dy);
      },

      bringSelectionToFront: () => {
        const ids = Array.from(get().selectedIds);
        if (ids.length === 0) return;
        set((s) => {
          let maxZ = 0;
          for (const n of Object.values(s.nodes)) {
            if (n.zIndex > maxZ) maxZ = n.zIndex;
          }
          let next = maxZ + 1;
          for (const id of ids) {
            const n = s.nodes[id];
            if (n) {
              n.zIndex = next++;
              n.updatedAt = Date.now();
            }
          }
        });
      },

      frameSelection: () => {
        const s = get();
        const boardId = s.boardId;
        if (!boardId) return '';
        const selected = Array.from(s.selectedIds)
          .map((id) => s.nodes[id])
          .filter(Boolean)
          .filter((n) => n.kind !== 'frame');

        let x: number, y: number, width: number, height: number;
        const pad = 40;
        if (selected.length === 0) {
          // Empty frame near viewport center in world coords
          const vp = s.viewport;
          width = 480;
          height = 360;
          x = (-vp.x) / vp.zoom + 80;
          y = (-vp.y) / vp.zoom + 80;
        } else {
          const xs = selected.map((n) => n.x);
          const ys = selected.map((n) => n.y);
          const xe = selected.map((n) => n.x + n.width);
          const ye = selected.map((n) => n.y + n.height);
          x = Math.min(...xs) - pad;
          y = Math.min(...ys) - pad - 28; // room for title bar
          width = Math.max(...xe) - Math.min(...xs) + pad * 2;
          height = Math.max(...ye) - Math.min(...ys) + pad * 2 + 28;
        }

        get().commit();
        const id = nanoid(10);
        set((draft) => {
          draft.nodes[id] = {
            id,
            boardId,
            kind: 'frame',
            title: selected.length ? 'Group' : 'Frame',
            x, y, width, height,
            zIndex: -1,
            color: 'default',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          draft.selectedIds = new Set([id]);
        });
        return id;
      },

      focusNode: (id, screenW, screenH) => set((s) => {
        const n = s.nodes[id];
        if (!n) return;
        s.selectedIds = new Set([id]);
        // Center node on screen at current zoom (or zoom out slightly if huge)
        const z = s.viewport.zoom;
        const cx = n.x + n.width / 2;
        const cy = n.y + n.height / 2;
        s.viewport = {
          zoom: z,
          x: screenW / 2 - cx * z,
          y: screenH / 2 - cy * z,
        };
      }),

      // updateNode is used for text typing too — we DON'T commit here either.
      // Text nodes can produce 100+ keystrokes per "edit session"; each one
      // shouldn't be a separate undo step. Instead, we commit once when the
      // user enters edit mode (handled in setEditing below).
      updateNode: (id, patch) => set((s) => {
        const n = s.nodes[id];
        if (!n) return;
        Object.assign(n, patch, { updatedAt: Date.now() });
      }),

      setSelectionColor: (color) => {
        const ids = Array.from(get().selectedIds);
        if (ids.length === 0) return;
        get().commit();
        set((s) => {
          const now = Date.now();
          for (const id of ids) {
            const n = s.nodes[id];
            if (n) {
              n.color = color;
              n.updatedAt = now;
            }
          }
        });
      },

      deleteNode: (id) => {
        get().commit();
        set((s) => {
          delete s.nodes[id];
          const touching = s.edgesByNode[id] || [];
          for (const eid of touching) delete s.edges[eid];
          s.edgesByNode = rebuildIndex(s.edges);
          s.selectedIds.delete(id);
        });
      },

      deleteSelection: () => {
        const ids = Array.from(get().selectedIds);
        if (ids.length === 0) return;
        get().commit();
        set((s) => {
          for (const id of ids) {
            delete s.nodes[id];
            const touching = s.edgesByNode[id] || [];
            for (const eid of touching) delete s.edges[eid];
          }
          s.edgesByNode = rebuildIndex(s.edges);
          s.selectedIds.clear();
        });
      },

      // ------------- EDGES -------------

      addEdge: (from, to) => {
        if (from === to) return;
        const exists = Object.values(get().edges).some(e => e.from === from && e.to === to);
        if (exists) return;
        get().commit();
        set((s) => {
          const id = nanoid(10);
          s.edges[id] = {
            id,
            boardId: s.boardId || '',
            from,
            to,
            style: 'solid',
            arrow: 'end',
            path: 'bezier',
          };
          (s.edgesByNode[from] ||= []).push(id);
          (s.edgesByNode[to]   ||= []).push(id);
        });
      },

      deleteEdge: (id) => {
        get().commit();
        set((s) => {
          delete s.edges[id];
          s.edgesByNode = rebuildIndex(s.edges);
          if (s.selectedEdgeId === id) s.selectedEdgeId = null;
        });
      },

      selectEdge: (id) => set((s) => {
        s.selectedEdgeId = id;
        if (id) s.selectedIds = new Set(); // exclusive with node selection
      }),

      updateEdge: (id, patch) => {
        if (!get().edges[id]) return;
        get().commit();
        set((s) => {
          const e = s.edges[id];
          if (!e) return;
          Object.assign(e, patch);
        });
      },

      setSelectionShape: (shape) => {
        const ids = Array.from(get().selectedIds);
        if (ids.length === 0) return;
        get().commit();
        set((s) => {
          for (const id of ids) {
            const n = s.nodes[id];
            if (n && n.kind === 'shape') {
              n.shape = shape;
              n.updatedAt = Date.now();
            }
          }
        });
      },

      // ------------- DUPLICATE / PASTE -------------

      duplicateSelection: () => {
        const s = get();
        const selectedIds = Array.from(s.selectedIds);
        if (selectedIds.length === 0) return;

        const sourceNodes = selectedIds.map(id => s.nodes[id]).filter(Boolean);
        if (sourceNodes.length === 0) return;

        // Edges that connect TWO selected nodes — those should also be duplicated
        const internalEdges = Object.values(s.edges).filter(
          e => s.selectedIds.has(e.from) && s.selectedIds.has(e.to)
        );

        get().commit();

        const idMap = new Map<string, string>();
        const offsetX = 24;
        const offsetY = 24;
        const newSelected: string[] = [];

        set((draft) => {
          for (const src of sourceNodes) {
            const newId = nanoid(10);
            idMap.set(src.id, newId);
            const copy = JSON.parse(JSON.stringify(src)) as CanvasNode;
            copy.id = newId;
            copy.x = src.x + offsetX;
            copy.y = src.y + offsetY;
            copy.createdAt = Date.now();
            copy.updatedAt = Date.now();
            draft.nodes[newId] = copy;
            newSelected.push(newId);
          }
          for (const e of internalEdges) {
            const newEdgeId = nanoid(10);
            const newFrom = idMap.get(e.from);
            const newTo = idMap.get(e.to);
            if (!newFrom || !newTo) continue;
            draft.edges[newEdgeId] = {
              id: newEdgeId,
              boardId: draft.boardId || '',
              from: newFrom,
              to: newTo,
              label: e.label,
              style: e.style,
            };
          }
          draft.edgesByNode = rebuildIndex(draft.edges);
          draft.selectedIds = new Set(newSelected);
        });
      },

      pasteAt: (worldX, worldY, payload) => {
        if (!payload || payload.kind !== 'nexuscanvas:v1') return;
        if (payload.nodes.length === 0) return;

        get().commit();

        // Compute offset so the centroid of pasted nodes lands at (worldX, worldY)
        const xs = payload.nodes.map(n => n.x);
        const ys = payload.nodes.map(n => n.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        // Shift so the top-left of the bounding box lands at the cursor
        const dx = worldX - minX;
        const dy = worldY - minY;

        const idMap = new Map<string, string>();
        const newSelected: string[] = [];

        set((draft) => {
          const boardId = draft.boardId || '';
          for (const src of payload.nodes) {
            const newId = nanoid(10);
            idMap.set(src.id, newId);
            const copy = JSON.parse(JSON.stringify(src)) as CanvasNode;
            copy.id = newId;
            copy.boardId = boardId;
            copy.x = src.x + dx;
            copy.y = src.y + dy;
            copy.createdAt = Date.now();
            copy.updatedAt = Date.now();
            draft.nodes[newId] = copy;
            newSelected.push(newId);
          }
          for (const e of payload.edges) {
            const newFrom = idMap.get(e.from);
            const newTo = idMap.get(e.to);
            if (!newFrom || !newTo) continue;
            const newEdgeId = nanoid(10);
            draft.edges[newEdgeId] = {
              id: newEdgeId,
              boardId,
              from: newFrom,
              to: newTo,
              label: e.label,
              style: e.style,
            };
          }
          draft.edgesByNode = rebuildIndex(draft.edges);
          draft.selectedIds = new Set(newSelected);
        });
      },

      // ------------- VIEWPORT (no history) -------------

      setViewport: (vp) => set((s) => { s.viewport = vp; }),
      panBy: (dx, dy) => set((s) => {
        s.viewport.x += dx;
        s.viewport.y += dy;
      }),
      zoomAt: (sx, sy, factor) => set((s) => {
        s.viewport = zoomedAt(s.viewport, sx, sy, factor);
      }),
      fitToContent: (screenW, screenH) => set((s) => {
        const nodes = Object.values(s.nodes);
        if (nodes.length === 0) {
          s.viewport = { x: screenW / 2, y: screenH / 2, zoom: 1 };
          return;
        }
        const xs = nodes.map(n => n.x);
        const ys = nodes.map(n => n.y);
        const xe = nodes.map(n => n.x + n.width);
        const ye = nodes.map(n => n.y + n.height);
        const box = {
          x: Math.min(...xs),
          y: Math.min(...ys),
          width: Math.max(...xe) - Math.min(...xs),
          height: Math.max(...ye) - Math.min(...ys),
        };
        s.viewport = fitBounds(box, screenW, screenH, 80);
      }),

      // ------------- TOOL / SELECTION -------------

      setTool: (tool) => set((s) => { s.tool = tool; }),
      select: (id, additive = false) => set((s) => {
        if (!additive) s.selectedIds.clear();
        s.selectedIds.add(id);
        s.selectedEdgeId = null;
        if (s.editingNodeId && s.editingNodeId !== id) s.editingNodeId = null;
        // Bring selected node to front so it isn't buried under neighbors
        const n = s.nodes[id];
        if (n) {
          let maxZ = 0;
          for (const other of Object.values(s.nodes)) {
            if (other.zIndex > maxZ) maxZ = other.zIndex;
          }
          if (n.zIndex < maxZ) n.zIndex = maxZ + 1;
        }
      }),
      selectMany: (ids, additive = false) => set((s) => {
        if (!additive) s.selectedIds.clear();
        for (const id of ids) {
          if (s.nodes[id]) s.selectedIds.add(id);
        }
      }),
      clearSelection: () => set((s) => {
        s.selectedIds.clear();
        s.selectedEdgeId = null;
      }),
      setHover: (id) => set((s) => { s.hoveredId = id; }),
      // Commit once when entering edit mode so the whole edit session undoes as one step
      setEditing: (id) => {
        if (id && get().editingNodeId !== id) get().commit();
        set((s) => { s.editingNodeId = id; });
      },

      // ------------- CONNECTION GESTURE -------------

      startConnection: (fromId, wx, wy) => set((s) => {
        s.connecting = { fromId, toWorldX: wx, toWorldY: wy };
      }),
      updateConnection: (wx, wy) => set((s) => {
        if (s.connecting) {
          s.connecting.toWorldX = wx;
          s.connecting.toWorldY = wy;
        }
      }),
      endConnection: (toId) => {
        const s = get();
        if (s.connecting && toId && toId !== s.connecting.fromId) {
          s.addEdge(s.connecting.fromId, toId);
        }
        set((draft) => { draft.connecting = null; });
      },
    }))
  )
);

// ============================================================
// CLIPBOARD HELPERS
// ============================================================

const CLIPBOARD_KEY = 'nexuscanvas:clipboard';

/**
 * Build a clipboard payload from the current selection.
 * Returns null if nothing is selected.
 */
export function buildClipboardPayload(): ClipboardPayload | null {
  const s = useBoard.getState();
  const selectedIds = Array.from(s.selectedIds);
  if (selectedIds.length === 0) return null;

  const nodes = selectedIds.map(id => s.nodes[id]).filter(Boolean);
  if (nodes.length === 0) return null;

  // Internal edges (both endpoints in selection)
  const edges = Object.values(s.edges).filter(
    e => s.selectedIds.has(e.from) && s.selectedIds.has(e.to)
  );

  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);

  return {
    kind: 'nexuscanvas:v1',
    nodes: JSON.parse(JSON.stringify(nodes)),
    edges: JSON.parse(JSON.stringify(edges)),
    originX: Math.min(...xs),
    originY: Math.min(...ys),
  };
}

/**
 * Try to copy the current selection to the system clipboard, falling back
 * to an in-memory store if clipboard permissions are denied.
 */
export async function copySelection(): Promise<void> {
  const payload = buildClipboardPayload();
  if (!payload) return;
  const json = JSON.stringify(payload);
  try {
    await navigator.clipboard.writeText(json);
  } catch {
    // Fallback to sessionStorage so paste still works within this tab
    sessionStorage.setItem(CLIPBOARD_KEY, json);
  }
}

/**
 * Try to read a clipboard payload. First checks the system clipboard,
 * then falls back to sessionStorage.
 */
export async function readClipboardPayload(): Promise<ClipboardPayload | null> {
  // Try system clipboard
  try {
    const text = await navigator.clipboard.readText();
    const parsed = JSON.parse(text);
    if (parsed?.kind === 'nexuscanvas:v1') return parsed as ClipboardPayload;
  } catch {
    // ignore — fall through to session storage
  }
  // Fallback
  const text = sessionStorage.getItem(CLIPBOARD_KEY);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed?.kind === 'nexuscanvas:v1') return parsed as ClipboardPayload;
  } catch {
    // ignore
  }
  return null;
}
