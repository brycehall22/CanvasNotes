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
  const [draggingFile, setDraggingFile] = useState(false);
  const assetId = node && node.kind === 'image' ? node.assetId : '';
  const [loaded, setLoaded] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    getImageUrl(assetId).then((u) => {
      if (!cancelled) setLoaded({ id: assetId, url: u });
    });
    return () => { cancelled = true; };
  }, [assetId]);

  const url = assetId && loaded?.id === assetId ? loaded.url : null;

  function measureImage(file: File): Promise<{ w: number; h: number }> {
    return new Promise((resolve, reject) => {
      const src = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(src); resolve({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 }); };
      img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('decode failed')); };
      img.src = src;
    });
  }   // define at module level

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    let size = { w: 240, h: 180 };
    try { size = await measureImage(file); } catch { /* keep default box */ }
    const newAssetId = await storeImageBlob(file);
    const scale = Math.min(MAX_W / size.w, MAX_H / size.h, 1);
    useBoard.getState().commit();
    updateNode(id, {
      assetId: newAssetId,
      alt: file.name,
      width: Math.max(120, Math.round(size.w * scale)),
      height: Math.max(80, Math.round(size.h * scale)),
    });
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
