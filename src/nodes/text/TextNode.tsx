// Markdown text node — simple edit / read cycle.

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useBoard } from '../../store';

interface Props { id: string; }

export function TextNodeContent({ id }: Props) {
  const node = useBoard((s) => s.nodes[id]);
  const editing = useBoard((s) => s.editingNodeId === id);
  const updateNode = useBoard((s) => s.updateNode);
  const setEditing = useBoard((s) => s.setEditing);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && taRef.current) {
      const ta = taRef.current;
      ta.focus();
      const len = ta.value.length;
      ta.setSelectionRange(len, len);
    }
  }, [editing]);

  if (!node || node.kind !== 'text') return null;

  if (editing) {
    return (
      <textarea
        ref={taRef}
        className="nx-text-editor nx-no-drag"
        value={node.markdown}
        onChange={(e) => updateNode(id, { markdown: e.target.value })}
        onBlur={() => setEditing(null)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') e.currentTarget.blur();
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') e.currentTarget.blur();
        }}
        onPointerDown={(e) => e.stopPropagation()}
      />
    );
  }

return (
  <div className="nx-text-read">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
        ),
      }}
    >
      {node.markdown}
    </ReactMarkdown>
  </div>
);
}
