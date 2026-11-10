"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Msg, Source, streamChat } from "../lib/api";

const SUGGESTIONS = [
  "Summarise the key points of this document",
  "What are the main conclusions?",
  "List any dates, numbers or deadlines mentioned",
];

function Answer({ text, sources, streaming }: { text: string; sources?: Source[]; streaming: boolean }) {
  const [open, setOpen] = useState<number | null>(null);

  // Clean up stray "[n]\n." patterns before rendering
  const cleaned = text
    .replace(/(\[\d+\])\s*\n+\s*([.!?,])/g, '$1$2')   // [n]\n. → [n].
    .replace(/([.!?])\s+(\[\d+\])\s*([.!?]?)/g, (_, p, ref, ep) => ` ${ref}${p}${ep}`); // .[n] → [n].

  const parts = cleaned.split(/(\[\d+\])/g);

  return (
    <div>
      <p className={`leading-relaxed ${streaming ? "caret" : ""}`} style={{ whiteSpace: "pre-wrap" }}>
        {parts.map((p, i) => {
          const m = /^\[(\d+)\]$/.exec(p);
          if (!m) return <Fragment key={i}>{p}</Fragment>;
          const n = Number(m[1]);
          const exists = sources?.some((s) => s.n === n);
          return (
            <sup key={i} className="inline">
              <button
                disabled={!exists}
                onClick={() => setOpen(open === n ? null : n)}
                className="mx-0.5 rounded bg-accent/20 px-1 py-0 align-super font-mono text-[10px] leading-none text-accent hover:bg-accent/35 disabled:opacity-30 transition"
                title={exists ? `Source ${n}` : undefined}
              >
                {n}
              </button>
            </sup>
          );
        })}
      </p>
      {sources && sources.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {sources.map((s) => (
            <button
              key={s.n}
              onClick={() => setOpen(open === s.n ? null : s.n)}
              className={`rounded-md border px-2 py-1 text-xs transition ${
                open === s.n
                  ? "border-accent bg-accent/10 text-accent-soft"
                  : "border-ink-600 text-zinc-400 hover:border-zinc-500"
              }`}
            >
              <span className="font-mono text-accent">[{s.n}]</span> {s.doc_name}{s.page ? ` · p.${s.page}` : ""}
            </button>
          ))}
        </div>
      )}
      {open !== null && sources?.find((s) => s.n === open) && (
        <blockquote className="mt-3 rounded-lg border-l-2 border-accent bg-ink-800 p-3 text-sm leading-relaxed text-zinc-300">
          {sources.find((s) => s.n === open)!.snippet}
          <div className="mt-2 font-mono text-xs text-zinc-500">
            relevance score: {sources.find((s) => s.n === open)!.score.toFixed(3)}
          </div>
        </blockquote>
      )}
    </div>
  );
}


export default function Chat({ docIds, hasDocs, useGraph = false }: { docIds: number[] | null; hasDocs: boolean; useGraph?: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(q: string) {
    const question = q.trim();
    if (!question || busy) return;
    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    abort.current = new AbortController();

    const patch = (fn: (m: Msg) => Msg) =>
      setMessages((all) => all.map((m, i) => (i === all.length - 1 ? fn(m) : m)));

    try {
      for await (const ev of streamChat(question, history, docIds, abort.current.signal, useGraph)) {
        if (ev.type === "sources") patch((m) => ({ ...m, sources: ev.data }));
        else if (ev.type === "token") patch((m) => ({ ...m, content: m.content + ev.data }));
        else if (ev.type === "error") patch((m) => ({ ...m, error: ev.data }));
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") patch((m) => ({ ...m, error: (e as Error).message }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="mx-auto max-w-3xl space-y-6">
          {messages.length === 0 && (
            <div className="pt-16 text-center">
              <h2 className="text-2xl font-semibold tracking-tight">
                {hasDocs ? "What would you like to know?" : "Upload a document to begin"}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-zinc-400">
                Answers are generated only from your documents and link back to the exact page.
              </p>
              {/* RAG mode badge */}
              <span className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${useGraph ? "bg-violet-900/60 text-violet-300" : "bg-zinc-800 text-zinc-400"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${useGraph ? "bg-violet-400" : "bg-zinc-500"}`} />
                {useGraph ? "GraphRAG mode" : "Standard RAG mode"}
              </span>
              {hasDocs && (
                <div className="mt-6 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full border border-ink-600 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-accent hover:text-accent-soft"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-md bg-accent/90 px-4 py-2.5 text-ink-950">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="max-w-[92%] rounded-2xl rounded-bl-md border border-ink-700 bg-ink-900 px-4 py-3">
                {m.content === "" && !m.error && !m.sources ? (
                  <span className="text-sm text-zinc-500">Searching documents…</span>
                ) : (
                  <Answer text={m.content} sources={m.sources} streaming={busy && i === messages.length - 1 && !m.error} />
                )}
                {m.error && <p className="mt-2 text-sm text-red-400">{m.error}</p>}
              </div>
            )
          )}
          <div ref={bottom} />
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="border-t border-ink-700 bg-ink-900/60 px-6 py-4"
      >
        <div className="mx-auto flex max-w-3xl gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={hasDocs ? "Ask a question about your documents…" : "Upload a document first"}
            disabled={!hasDocs}
            className="flex-1 rounded-xl border border-ink-600 bg-ink-800 px-4 py-3 text-sm outline-none transition placeholder:text-zinc-500 focus:border-accent disabled:opacity-50"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="rounded-xl border border-ink-600 px-5 text-sm text-zinc-300 hover:border-zinc-400"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !hasDocs}
              className="rounded-xl bg-accent px-5 text-sm font-medium text-ink-950 transition hover:bg-accent-soft disabled:opacity-40"
            >
              Ask
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
