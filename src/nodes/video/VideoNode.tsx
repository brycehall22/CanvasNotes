// src/nodes/video/VideoNode.tsx
//
// Three states:
//   1. No URL → URL input (active when editingNodeId === id)
//   2. Has URL, idle → static thumbnail + INTERACT button in corner. Drag works
//      everywhere, the button is the only thing that loads the iframe.
//   3. Interactive → live iframe. Drag suspended. EXIT button in corner returns
//      to idle, also Escape and click-outside-the-node.
//
// We use editingNodeId from the store as the "active" flag — same primitive
// text nodes use, keeps the architecture consistent.

import { useState } from 'react';
import { useBoard } from '../../store';

interface Props { id: string; }

function parseVideoUrl(url: string): { provider: 'youtube' | 'vimeo'; videoId: string } | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) return { provider: 'youtube', videoId: yt[1] };
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return { provider: 'vimeo', videoId: vm[1] };
  return null;
}

export function VideoNodeContent({ id }: Props) {
  const node = useBoard((s) => s.nodes[id]);
  const updateNode = useBoard((s) => s.updateNode);
  const editing = useBoard((s) => s.editingNodeId === id);
  const setEditing = useBoard((s) => s.setEditing);
  const [urlInput, setUrlInput] = useState('');

  if (!node || node.kind !== 'video') return null;

  const hasVideo = !!node.videoId;

  // ---------- State 1: URL input ----------
  if (!hasVideo) {
    const commit = () => {
      const parsed = parseVideoUrl(urlInput);
      if (parsed) {
        updateNode(id, parsed);
        setEditing(null);
        setUrlInput('');
      }
    };
    return (
      <div className="nx-video-empty">
        <input
          type="url"
          className="nx-no-drag"
          placeholder="Paste YouTube or Vimeo URL…"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') setEditing(null);
          }}
          autoFocus
        />
        <button type="button" className="nx-no-drag" onClick={commit}>Embed</button>
      </div>
    );
  }

  const thumbnailUrl = node.provider === 'youtube'
    ? `https://i.ytimg.com/vi/${node.videoId}/hqdefault.jpg`
    : '';

  // ---------- State 3: Interactive (iframe live) ----------
  if (editing) {
    const embedUrl = node.provider === 'youtube'
      ? `https://www.youtube.com/embed/${node.videoId}?autoplay=1&mute=1&playsinline=1&rel=0`
      : `https://player.vimeo.com/video/${node.videoId}?autoplay=1&muted=1&playsinline=1`;

    return (
      <div className="nx-video nx-video-active nx-no-drag">
        <iframe
          src={embedUrl}
          title="Embedded video"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
        <button
          className="nx-video-corner-btn nx-video-exit"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(null);
          }}
          title="Stop and return to drag mode (Esc)"
          aria-label="Exit video"
        >
          <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // ---------- State 2: Static facade with INTERACT button ----------
  // The whole facade is draggable. Only the button enters interactive mode.
  return (
    <div
      className="nx-video-facade"
      style={thumbnailUrl ? { backgroundImage: `url(${thumbnailUrl})` } : undefined}
    >
      <div className="nx-video-playbutton" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
      <button
        className="nx-video-corner-btn nx-video-interact"
        onClick={(e) => {
          e.stopPropagation();
          setEditing(id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        title="Play video"
        aria-label="Play video"
      >
        <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        <span>Play</span>
      </button>
    </div>
  );
}
