// src/types/domain.ts

export interface Viewport {
  /** World X that aligns with screen X = 0 */
  x: number;
  /** World Y that aligns with screen Y = 0 */
  y: number;
  /** Pixels per world unit — clamp to [0.25, 3] */
  zoom: number;
}

export type NodeKind =
  | 'text'
  | 'sticky'
  | 'todo'
  | 'shape'
  | 'frame'
  | 'image'
  | 'video'
  | 'link';

/** Flowchart / diagram shapes (draw.io-style essentials) */
export type ShapeType = 'rect' | 'rounded' | 'ellipse' | 'diamond';

export const SHAPE_TYPES: ShapeType[] = ['rect', 'rounded', 'ellipse', 'diamond'];

/** Preset accent colors for cards (Miro/Milanote-style) */
export type NodeColor =
  | 'default'
  | 'yellow'
  | 'orange'
  | 'red'
  | 'pink'
  | 'purple'
  | 'blue'
  | 'teal'
  | 'green'
  | 'gray';

export const NODE_COLORS: NodeColor[] = [
  'default', 'yellow', 'orange', 'red', 'pink',
  'purple', 'blue', 'teal', 'green', 'gray',
];

interface BaseNode {
  id: string;
  boardId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  color?: NodeColor;
  createdAt: number;
  updatedAt: number;
}

export interface TextNode extends BaseNode {
  kind: 'text';
  markdown: string;
}

export interface StickyNode extends BaseNode {
  kind: 'sticky';
  text: string;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoNode extends BaseNode {
  kind: 'todo';
  title: string;
  items: TodoItem[];
}

/** Diagram shape with centered editable label */
export interface ShapeNode extends BaseNode {
  kind: 'shape';
  shape: ShapeType;
  text: string;
}

export interface FrameNode extends BaseNode {
  kind: 'frame';
  title: string;
  /** When true, frame draws as a compact title card */
  collapsed?: boolean;
  /** Height before collapse (restored on expand) */
  expandedHeight?: number;
}

export interface ImageNode extends BaseNode {
  kind: 'image';
  assetId: string;
  alt?: string;
}

export interface VideoNode extends BaseNode {
  kind: 'video';
  provider: 'youtube' | 'vimeo';
  videoId: string;
}

export interface LinkNode extends BaseNode {
  kind: 'link';
  url: string;
  preview?: { title: string; description: string; image?: string };
}

export type CanvasNode =
  | TextNode
  | StickyNode
  | TodoNode
  | ShapeNode
  | FrameNode
  | ImageNode
  | VideoNode
  | LinkNode;

/** Arrow heads on connectors */
export type EdgeArrow = 'none' | 'end' | 'start' | 'both';

/** Connector path style */
export type EdgePath = 'bezier' | 'straight';

export interface Edge {
  id: string;
  boardId: string;
  from: string;
  to: string;
  label?: string;
  style?: 'solid' | 'dashed';
  arrow?: EdgeArrow;
  path?: EdgePath;
}

export interface Board {
  id: string;
  name: string;
  viewport: Viewport;
  updatedAt: number;
}

export const FRAME_TITLE_HEIGHT = 44;

export function nodeSearchText(n: CanvasNode): string {
  switch (n.kind) {
    case 'text':
      return n.markdown || '';
    case 'sticky':
    case 'shape':
      return n.text || '';
    case 'todo':
      return [n.title, ...n.items.map((i) => i.text)].filter(Boolean).join(' ');
    case 'frame':
      return n.title || '';
    case 'link':
      return [n.url, n.preview?.title, n.preview?.description].filter(Boolean).join(' ');
    case 'image':
      return n.alt || '';
    case 'video':
      return `${n.provider} ${n.videoId}`;
    default:
      return '';
  }
}

export function nodeCenterInFrame(
  node: { x: number; y: number; width: number; height: number },
  frame: { x: number; y: number; width: number; height: number },
): boolean {
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  return (
    cx >= frame.x &&
    cx <= frame.x + frame.width &&
    cy >= frame.y &&
    cy <= frame.y + frame.height
  );
}


/** Short title for pickers, backlinks, minimap labels */
export function nodeTitle(n: CanvasNode): string {
  switch (n.kind) {
    case 'text': {
      const line = (n.markdown || '').split('\n').find((l) => l.trim());
      if (!line) return 'Note';
      return line.replace(/^#+\s*/, '').replace(/\[\[|\]\]/g, '').trim().slice(0, 48) || 'Note';
    }
    case 'sticky':
      return (n.text || 'Sticky').split('\n')[0].slice(0, 48);
    case 'todo':
      return n.title || 'Checklist';
    case 'shape':
      return n.text || 'Shape';
    case 'frame':
      return n.title || 'Frame';
    case 'link':
      return n.preview?.title || n.url || 'Link';
    case 'image':
      return n.alt || 'Image';
    case 'video':
      return n.videoId ? `Video ${n.videoId}` : 'Video';
    default:
      return 'Node';
  }
}

/** Match [[wiki-link]] targets in markdown */
export function extractWikiLinks(markdown: string): string[] {
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m;
  while ((m = re.exec(markdown)) !== null) {
    const t = m[1].trim();
    if (t && !out.includes(t)) out.push(t);
  }
  return out;
}
