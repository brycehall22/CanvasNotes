// Checklist / todo node.
//
// Drag/select: the whole card participates via NodeShape. Interactive controls
// use .nx-no-drag so they still receive clicks without starting a drag.
// Title row is the primary grab area; item labels are plain text until edited.

import { useEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { useBoard } from '../../store';
import type { TodoItem, TodoNode as TodoNodeType } from '../../types/domain';

interface Props { id: string; }

export function TodoNodeContent({ id }: Props) {
  const node = useBoard((s) => s.nodes[id]);
  const editing = useBoard((s) => s.editingNodeId === id);
  const updateNode = useBoard((s) => s.updateNode);
  const setEditing = useBoard((s) => s.setEditing);
  const titleRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState('');
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const itemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && titleRef.current) {
      titleRef.current.focus();
      titleRef.current.select();
    }
  }, [editing]);

  useEffect(() => {
    if (editItemId && itemInputRef.current) {
      itemInputRef.current.focus();
      itemInputRef.current.select();
    }
  }, [editItemId]);

  if (!node || node.kind !== 'todo') return null;
  const todo = node as TodoNodeType;

  const setItems = (items: TodoItem[]) => updateNode(id, { items });

  const toggle = (itemId: string) => {
    setItems(todo.items.map((it) =>
      it.id === itemId ? { ...it, done: !it.done } : it
    ));
  };

  const updateItemText = (itemId: string, text: string) => {
    setItems(todo.items.map((it) =>
      it.id === itemId ? { ...it, text } : it
    ));
  };

  const removeItem = (itemId: string) => {
    setItems(todo.items.filter((it) => it.id !== itemId));
    if (editItemId === itemId) setEditItemId(null);
  };

  const addItem = () => {
    const text = draft.trim();
    if (!text) return;
    setItems([...todo.items, { id: nanoid(8), text, done: false }]);
    setDraft('');
  };

  const doneCount = todo.items.filter((i) => i.done).length;

  return (
    <div className="nx-todo">
      {/* Grab strip — always draggable chrome */}
      <div
        className="nx-todo-drag"
        title="Drag to move"
        aria-hidden="true"
      >
        <span className="nx-todo-drag-dots" />
      </div>

      {editing ? (
        <input
          ref={titleRef}
          className="nx-todo-title-input nx-no-drag"
          value={todo.title}
          onChange={(e) => updateNode(id, { title: e.target.value })}
          onBlur={() => setEditing(null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
          }}
        />
      ) : (
        <div
          className="nx-todo-title"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditing(id);
          }}
        >
          <span className="nx-todo-title-text">{todo.title || 'Checklist'}</span>
          <span className="nx-todo-progress">{doneCount}/{todo.items.length}</span>
        </div>
      )}

      <ul className="nx-todo-list">
        {todo.items.map((it) => (
          <li key={it.id} className={it.done ? 'nx-todo-done' : ''}>
            <button
              type="button"
              className="nx-todo-check nx-no-drag"
              onClick={() => toggle(it.id)}
              aria-label={it.done ? 'Mark incomplete' : 'Mark complete'}
            >
              {it.done ? '✓' : ''}
            </button>
            {editItemId === it.id ? (
              <input
                ref={itemInputRef}
                className="nx-todo-item-text nx-no-drag"
                value={it.text}
                onChange={(e) => updateItemText(it.id, e.target.value)}
                onBlur={() => setEditItemId(null)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
                }}
              />
            ) : (
              <span
                className="nx-todo-item-label"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  setEditItemId(it.id);
                }}
              >
                {it.text || 'Untitled'}
              </span>
            )}
            <button
              type="button"
              className="nx-todo-remove nx-no-drag"
              onClick={() => removeItem(it.id)}
              aria-label="Remove item"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <div className="nx-todo-add nx-no-drag">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addItem();
          }}
          placeholder="Add item…"
        />
        <button type="button" onClick={addItem} disabled={!draft.trim()}>+</button>
      </div>
    </div>
  );
}
