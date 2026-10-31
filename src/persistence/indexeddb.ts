// src/persistence/indexeddb.ts
// Local persistence via Dexie. One database, three tables: boards, nodes, edges.

import Dexie, { type Table } from 'dexie';
import type { Board, CanvasNode, Edge } from '../types/domain';

class NexusDB extends Dexie {
  boards!: Table<Board, string>;
  nodes!: Table<CanvasNode, string>;
  edges!: Table<Edge, string>;

  constructor() {
    super('nexuscanvas');
    this.version(1).stores({
      boards: 'id, updatedAt',
      nodes: 'id, boardId, updatedAt',
      edges: 'id, boardId, from, to',
    });
  }
}

export const db = new NexusDB();

// ---------------- Board CRUD ----------------

export async function listBoards(): Promise<Board[]> {
  return db.boards.orderBy('updatedAt').reverse().toArray();
}

export async function getBoard(id: string): Promise<Board | undefined> {
  return db.boards.get(id);
}

export async function createBoard(name: string): Promise<Board> {
  const { nanoid } = await import('nanoid');
  const board: Board = {
    id: nanoid(10),
    name,
    viewport: { x: 200, y: 150, zoom: 1 },
    updatedAt: Date.now(),
  };
  await db.boards.put(board);
  return board;
}

export async function renameBoard(id: string, name: string): Promise<void> {
  await db.boards.update(id, { name, updatedAt: Date.now() });
}

export async function deleteBoard(id: string): Promise<void> {
  await db.transaction('rw', db.boards, db.nodes, db.edges, async () => {
    await db.boards.delete(id);
    await db.nodes.where('boardId').equals(id).delete();
    await db.edges.where('boardId').equals(id).delete();
  });
}

export async function updateBoardViewport(id: string, viewport: Board['viewport']): Promise<void> {
  await db.boards.update(id, { viewport, updatedAt: Date.now() });
}

// ---------------- Board contents ----------------

export async function loadBoardContents(boardId: string): Promise<{ nodes: CanvasNode[]; edges: Edge[] }> {
  const [nodes, edges] = await Promise.all([
    db.nodes.where('boardId').equals(boardId).toArray(),
    db.edges.where('boardId').equals(boardId).toArray(),
  ]);
  return { nodes, edges };
}

/**
 * Full-board snapshot write. Called on debounced auto-save.
 * Uses a transaction so the on-disk state is always consistent.
 */
export async function saveBoardSnapshot(
  boardId: string,
  nodes: CanvasNode[],
  edges: Edge[],
  viewport: Board['viewport']
): Promise<void> {
  await db.transaction('rw', db.boards, db.nodes, db.edges, async () => {
    // Delete any stale nodes/edges not in the current set
    const existingNodeIds = new Set(await db.nodes.where('boardId').equals(boardId).primaryKeys());
    const existingEdgeIds = new Set(await db.edges.where('boardId').equals(boardId).primaryKeys());
    const keepNodeIds = new Set(nodes.map(n => n.id));
    const keepEdgeIds = new Set(edges.map(e => e.id));

    const nodesToDelete = [...existingNodeIds].filter(id => !keepNodeIds.has(id as string));
    const edgesToDelete = [...existingEdgeIds].filter(id => !keepEdgeIds.has(id as string));

    if (nodesToDelete.length) await db.nodes.bulkDelete(nodesToDelete as string[]);
    if (edgesToDelete.length) await db.edges.bulkDelete(edgesToDelete as string[]);

    if (nodes.length) await db.nodes.bulkPut(nodes);
    if (edges.length) await db.edges.bulkPut(edges);

    await db.boards.update(boardId, { viewport, updatedAt: Date.now() });
  });
}

// ---------------- Image assets ----------------

const imageCache: Map<string, string> = new Map();

export async function storeImageBlob(blob: Blob): Promise<string> {
  const { nanoid } = await import('nanoid');
  const assetId = nanoid(12);
  // Dexie's default blob storage via a simple table
  await db.table('assets').put({ id: assetId, blob }).catch(async () => {
    // table may not exist on older DBs — upgrade inline
    db.close();
    db.version(2).stores({
      boards: 'id, updatedAt',
      nodes: 'id, boardId, updatedAt',
      edges: 'id, boardId, from, to',
      assets: 'id',
    });
    await db.open();
    await db.table('assets').put({ id: assetId, blob });
  });
  return assetId;
}

export async function getImageUrl(assetId: string): Promise<string | null> {
  if (!assetId) return null;
  if (imageCache.has(assetId)) return imageCache.get(assetId)!;
  try {
    const rec = await db.table('assets').get(assetId);
    if (!rec?.blob) return null;
    const url = URL.createObjectURL(rec.blob);
    imageCache.set(assetId, url);
    return url;
  } catch {
    return null;
  }
}

// Register the assets table up front so the first save doesn't hit the fallback path
db.version(2).stores({
  boards: 'id, updatedAt',
  nodes: 'id, boardId, updatedAt',
  edges: 'id, boardId, from, to',
  assets: 'id',
});
