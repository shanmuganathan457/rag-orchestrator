"use client";

import { useRef, useState } from "react";
import { useVisualization } from "../context/VisualizationContext";

export default function TabBar() {
  const { tabs, activeTabId, addTab, renameTab, closeTab, selectTab } = useVisualization();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editRef = useRef<HTMLInputElement>(null);

  function startRename(id: string) {
    setEditingId(id);
    setTimeout(() => editRef.current?.focus(), 0);
  }

  function commitRename(id: string) {
    const val = editRef.current?.value.trim();
    if (val) renameTab(id, val);
    setEditingId(null);
  }

  return (
    <div className="flex items-center gap-1 border-b border-ink-700 bg-ink-900 px-2 pt-1 overflow-x-auto scrollbar-hide">
      {tabs.map((t) => (
        <div
          key={t.id}
          onClick={() => selectTab(t.id)}
          onDoubleClick={() => startRename(t.id)}
          className={`group relative flex min-w-[100px] max-w-[180px] cursor-pointer items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition select-none ${
            activeTabId === t.id
              ? "bg-ink-800 text-zinc-100 border-b-2 border-accent"
              : "text-zinc-500 hover:bg-ink-800/50 hover:text-zinc-300"
          }`}
        >
          {editingId === t.id ? (
            <input
              ref={editRef}
              defaultValue={t.name}
              onBlur={() => commitRename(t.id)}
              onKeyDown={(e) => { if (e.key === "Enter") commitRename(t.id); if (e.key === "Escape") setEditingId(null); }}
              className="w-full bg-transparent outline-none text-xs text-zinc-100"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="truncate">{t.name}</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); closeTab(t.id); }}
            className="ml-auto text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition text-sm leading-none"
            title="Close tab"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addTab}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-ink-800 hover:text-zinc-200 transition text-lg leading-none"
        title="New sheet"
      >
        +
      </button>
    </div>
  );
}
