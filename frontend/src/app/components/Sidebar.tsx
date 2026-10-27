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
};

export default function Sidebar({ docs, selected, health, onToggle, onChanged, onSettings }: Props) {
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
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-ink-700 bg-ink-900">
      <div className="px-5 pb-4 pt-5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 font-mono text-sm text-accent">
            dm
          </div>
          <h1 className="text-lg font-semibold tracking-tight">RAG Orchestrator</h1>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
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

      <div className="border-t border-ink-700 px-5 py-3 text-xs text-zinc-500 flex items-center justify-between">
        <span>
          {health ? (
            <span>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {health.llm_provider} · <span className="font-mono">{health.llm_model}</span>
            </span>
          ) : (
            <span>
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-red-400" />
              API unreachable
            </span>
          )}
        </span>
        <button
          onClick={onSettings}
          title="LLM Provider Settings"
          className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-ink-800 hover:text-zinc-200"
        >
          ⚙
        </button>
      </div>
    </aside>
  );
}
