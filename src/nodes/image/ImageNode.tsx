// Image node — empty drop zone; filled image auto-fits node aspect ratio.

import { useEffect, useState } from 'react';
import { useBoard } from '../../store';
import { getImageUrl, storeImageBlob } from '../../persistence/indexeddb';

interface Props { id: string; }

const MAX_W = 360;
const MAX_H = 280;

export function ImageNodeContent({ id }: Props) {
  const node = useBoard((s) => s.nodes[id]);
  const updateNode = useBoard((s) => s.updateNode);
  const [url, setUrl] = useState<string | null>(null);
  const [draggingFile, setDraggingFile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (node && node.kind === 'image' && node.assetId) {
      getImageUrl(node.assetId).then((u) => { if (!cancelled) setUrl(u); });
    } else {
      setUrl(null);
    }
    return () => { cancelled = true; };
  }, [node]);

  // Auto-fit node to image aspect once the bitmap is known
  useEffect(() => {
    if (!url || !node || node.kind !== 'image') return;
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth || 1;
      const nh = img.naturalHeight || 1;
      const scale = Math.min(MAX_W / nw, MAX_H / nh, 1);
      const w = Math.max(120, Math.round(nw * scale));
      const h = Math.max(80, Math.round(nh * scale));
      const cur = useBoard.getState().nodes[id];
      if (!cur || cur.kind !== 'image') return;
      // Only resize when still near default placeholder size or aspect is way off
      const aspect = w / h;
      const curAspect = cur.width / Math.max(cur.height, 1);
      if (
        Math.abs(cur.width - 240) < 8 && Math.abs(cur.height - 180) < 8 ||
        Math.abs(aspect - curAspect) > 0.15
      ) {
        useBoard.getState().updateNode(id, { width: w, height: h });
      }
    };
    img.src = url;
  }, [url, id]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const assetId = await storeImageBlob(file);
    updateNode(id, { assetId, alt: file.name });
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await handleFile(file);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  };

  if (!node || node.kind !== 'image') return null;

  if (!url) {
    return (
      <div
        className={`nx-image-empty${draggingFile ? ' nx-image-drop-active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDraggingFile(true); }}
        onDragLeave={() => setDraggingFile(false)}
        onDrop={onDrop}
      >
        <div className="nx-image-empty-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="10" r="1.5" />
            <path d="M21 15l-5-5-8 8" />
          </svg>
        </div>
        <div className="nx-image-empty-label">Drop an image here</div>
        <label className="nx-image-upload-btn nx-no-drag">
          Choose file
          <input type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
        </label>
      </div>
    );
  }

  return (
    <div className="nx-image">
      <img src={url} alt={node.alt || ''} draggable={false} />
    </div>
  );
}
