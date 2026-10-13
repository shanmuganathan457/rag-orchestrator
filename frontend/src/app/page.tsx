"use client";

import { useCallback, useEffect, useState } from "react";
import Chat from "./components/Chat";
import Evaluation from "./components/Evaluation";
import Sidebar from "./components/Sidebar";
import { Doc, Health, getHealth, listDocs } from "./lib/api";

export default function Home() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [health, setHealth] = useState<Health | null>(null);
  const [tab, setTab] = useState<"chat" | "eval">("chat");

  const refresh = useCallback(async () => {
    try {
      const d = await listDocs();
      setDocs(d);
      setSelected((s) => new Set(Array.from(s).filter((id) => d.some((x) => x.id === id))));
    } catch {
      /* API not reachable yet; health indicator shows it */
    }
  }, []);

  useEffect(() => {
    refresh();
    getHealth().then(setHealth).catch(() => setHealth(null));
  }, [refresh]);

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex h-screen">
      <Sidebar docs={docs} selected={selected} health={health} onToggle={toggle} onChanged={refresh} />
      <main className="flex min-w-0 flex-1 flex-col">
        <nav className="flex gap-1 border-b border-ink-700 px-6 pt-3">
          {(["chat", "eval"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-lg px-4 py-2 text-sm font-medium transition ${
                tab === t ? "border-b-2 border-accent text-accent-soft" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "chat" ? "Chat" : "Evaluation"}
            </button>
          ))}
        </nav>
        <div className="min-h-0 flex-1">
          {tab === "chat" ? (
            <Chat docIds={selected.size ? Array.from(selected) : null} hasDocs={docs.length > 0} />
          ) : (
            <Evaluation hasDocs={docs.length > 0} />
          )}
        </div>
      </main>
    </div>
  );
}
