"use client";

import { useRef, useState } from "react";
import { Doc, Health, deleteDoc, uploadDoc } from "../lib/api";

type Props = {
  docs: Doc[];
  selected: Set<number>;
  health: Health | null;
  onToggle: (id: number) => void;
  onChanged: () => void;
  onSettings: () => void;
  onCloseSidebar?: () => void;
};

export default function Sidebar({ docs, selected, health, onToggle, onChanged, onSettings, onCloseSidebar }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) await uploadDoc(f);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-ink-700 bg-ink-900 select-none">
      {/* Header */}
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 font-mono text-sm font-semibold text-accent shadow-inner">
              dm
            </div>
            <h1 className="text-base font-semibold tracking-tight text-zinc-100">RAG Orchestrator</h1>
          </div>
          {/* Collapse sidebar button */}
          <button
            onClick={onCloseSidebar}
            title="Collapse sidebar"
            className="group flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-ink-800 hover:text-zinc-100"
            aria-label="Collapse sidebar"
          >
            <svg
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M9 3v18" />
              <path d="m14 9-3 3 3 3" />
            </svg>
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-zinc-400">
          Ask questions about your documents. Every answer cites its sources.
        </p>
      </div>

      <div className="px-5">
        <div
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => input.current?.click()}
          className={`cursor-pointer rounded-xl border border-dashed p-5 text-center text-sm transition ${
            drag ? "border-accent bg-accent/10" : "border-ink-600 hover:border-zinc-500"
          }`}
        >
          <input
            ref={input}
            type="file"
            accept=".pdf,.txt,.md,.csv,.docx"
            multiple
            hidden
            onChange={(e) => handleFiles(e.target.files)}
          />
          {busy ? (
            <span className="text-accent-soft">Indexing… (chunking + embedding)</span>
          ) : (
            <>
              <div className="font-medium">Drop files or click to upload</div>
              <div className="mt-1 text-xs text-zinc-500">PDF · TXT · MD · CSV · DOCX</div>
            </>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      </div>

      <div className="mt-5 flex items-center justify-between px-5 text-xs uppercase tracking-wider text-zinc-500">
        <span>Documents ({docs.length})</span>
        <span>{selected.size ? `${selected.size} selected` : "searching all"}</span>
      </div>

      <ul className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
        {docs.length === 0 && <li className="px-2 py-6 text-center text-sm text-zinc-500">No documents yet.</li>}
        {docs.map((d) => (
          <li
            key={d.id}
            className={`group flex items-start gap-3 rounded-lg px-2 py-2 transition hover:bg-ink-800 ${
              selected.has(d.id) ? "bg-ink-800" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={selected.has(d.id)}
              onChange={() => onToggle(d.id)}
              className="mt-1 accent-[#7c9cff]"
              aria-label={`Limit search to ${d.name}`}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium" title={d.name}>{d.name}</div>
              <div className="text-xs text-zinc-500">{d.pages} pages · {d.chunks} chunks</div>
            </div>
            <button
              onClick={async () => { await deleteDoc(d.id); onChanged(); }}
              className="text-xs text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
              aria-label={`Delete ${d.name}`}
            >
              delete
            </button>
          </li>
        ))}
      </ul>

      {/* Footer / Status */}
      <div className="border-t border-ink-700/80 bg-ink-950/40 px-4 py-3 text-xs text-zinc-400 flex items-center justify-between">
        <span className="truncate pr-2">
          {health ? (
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="truncate">
                {health.llm_provider} · <span className="font-mono text-zinc-300">{health.llm_model}</span>
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span>API unreachable</span>
            </span>
          )}
        </span>
        <button
          onClick={onSettings}
          title="LLM Provider & GraphRAG Settings"
          className="group relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-700 bg-ink-800/80 text-zinc-400 shadow-sm transition hover:border-zinc-500 hover:bg-ink-700 hover:text-zinc-100"
          aria-label="Settings"
        >
          <svg
            className="h-4.5 w-4.5 transition-transform duration-300 group-hover:rotate-45"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
