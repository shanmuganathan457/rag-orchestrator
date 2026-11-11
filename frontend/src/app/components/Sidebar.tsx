"use client";

import { useMemo, useRef, useState } from "react";
import { Doc, Health, Msg, deleteDoc, uploadDoc } from "../lib/api";

export type ChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  messages: Msg[];
};

type Props = {
  docs: Doc[];
  selected: Set<number>;
  health: Health | null;
  onToggle: (id: number) => void;
  onChanged: () => void;
  onSettings: () => void;
  onCloseSidebar?: () => void;
  /** When true, only show Data Studio compatible files (CSV, JSON, etc.) */
  showStudio?: boolean;
  /** Chat history management */
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  sidebarTab: "docs" | "chats";
  onSetSidebarTab: (tab: "docs" | "chats") => void;
};

export default function Sidebar({
  docs,
  selected,
  health,
  onToggle,
  onChanged,
  onSettings,
  onCloseSidebar,
  showStudio,
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  sidebarTab,
  onSetSidebarTab,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // Filter docs for Data Studio view (CSV, JSON, etc.) and search query
  const displayedDocs = useMemo(() => {
    let list = docs;
    if (showStudio) {
      list = list.filter((d) => /\.(csv|json|xlsx?|tsv)$/i.test(d.name));
    }
    if (searchQuery.trim() && sidebarTab === "docs") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    return list;
  }, [docs, showStudio, searchQuery, sidebarTab]);

  // Filter chat sessions by search query
  const displayedSessions = useMemo(() => {
    let list = sessions;
    if (searchQuery.trim() && sidebarTab === "chats") {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((s) => s.title.toLowerCase().includes(q));
    }
    return list;
  }, [sessions, searchQuery, sidebarTab]);

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
      {/* Header with ChatGPT style branding & icons */}
      <div className="px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* Project Logo Image */}
            <div className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-900 shadow-md">
              <img
                src="/logo.jpg"
                alt="RAG Orchestrator Logo"
                className="h-full w-full object-cover"
              />
            </div>
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">RAG Orchestrator</h1>
          </div>

          <div className="flex items-center gap-1">
            {/* New Chat Button */}
            <button
              onClick={onNewSession}
              title="New Chat"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-ink-800 hover:text-zinc-100"
              aria-label="New chat"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>

            {/* Search toggle icon */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              title={sidebarTab === "docs" ? "Search files" : "Search chats"}
              className={`flex h-7 w-7 items-center justify-center rounded-md transition ${
                showSearch
                  ? "bg-ink-800 text-zinc-100"
                  : "text-zinc-400 hover:bg-ink-800 hover:text-zinc-200"
              }`}
              aria-label="Search"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </button>

            {/* Collapse sidebar icon */}
            <button
              onClick={onCloseSidebar}
              title="Close sidebar"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-ink-800 hover:text-zinc-200"
              aria-label="Close sidebar"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 3v18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Expandable search bar */}
        {showSearch && (
          <div className="mt-2.5">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  sidebarTab === "docs"
                    ? showStudio
                      ? "Search data files (CSV, JSON)..."
                      : "Search all files..."
                    : "Search chat history..."
                }
                className="w-full rounded-md border border-ink-700 bg-ink-950 px-2.5 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:border-accent focus:outline-none"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1.5 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* Tab switch buttons: Documents vs Chat History */}
        <div className="mt-3 flex rounded-lg bg-ink-950/80 p-0.5 border border-ink-700/60">
          <button
            onClick={() => onSetSidebarTab("docs")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
              sidebarTab === "docs"
                ? "bg-ink-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span>Documents</span>
            <span className="text-[10px] text-zinc-500">({docs.length})</span>
          </button>

          <button
            onClick={() => onSetSidebarTab("chats")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
              sidebarTab === "chats"
                ? "bg-ink-800 text-zinc-100 shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>Chats</span>
            <span className="text-[10px] text-zinc-500">({sessions.length})</span>
          </button>
        </div>
      </div>

      {sidebarTab === "docs" ? (
        <>
          {/* Upload Zone */}
          <div className="px-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                handleFiles(e.dataTransfer.files);
              }}
              onClick={() => input.current?.click()}
              className={`cursor-pointer rounded-xl border border-dashed p-3.5 text-center text-xs transition ${
                drag ? "border-accent bg-accent/10" : "border-ink-600 hover:border-zinc-500"
              }`}
            >
              <input
                ref={input}
                type="file"
                accept=".pdf,.txt,.md,.csv,.docx,.json"
                multiple
                hidden
                onChange={(e) => handleFiles(e.target.files)}
              />
              {busy ? (
                <span className="text-accent-soft font-medium">Indexing… (chunking + embedding)</span>
              ) : (
                <>
                  <div className="font-medium text-zinc-200">Drop files or click to upload</div>
                  <div className="mt-1 text-[11px] text-zinc-500">
                    {showStudio ? "CSV · JSON · XLSX" : "PDF · TXT · MD · CSV · DOCX"}
                  </div>
                </>
              )}
            </div>
            {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
          </div>

          {/* Documents count & status */}
          <div className="mt-4 flex items-center justify-between px-4 text-[11px] uppercase tracking-wider text-zinc-500">
            <span>
              {showStudio ? "Data Studio Files" : "Documents"} ({displayedDocs.length})
            </span>
            <span>{selected.size ? `${selected.size} selected` : "searching all"}</span>
          </div>

          {/* File list */}
          <ul className="mt-2 flex-1 space-y-1 overflow-y-auto px-3 pb-3">
            {displayedDocs.length === 0 && (
              <li className="px-2 py-6 text-center text-xs text-zinc-500">
                {searchQuery
                  ? "No matching files found."
                  : showStudio
                  ? "No data files (CSV/JSON) found."
                  : "No documents yet."}
              </li>
            )}
            {displayedDocs.map((d) => (
              <li
                key={d.id}
                className={`group flex items-start gap-2.5 rounded-lg px-2 py-2 transition hover:bg-ink-800 ${
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
                  <div className="truncate text-xs font-medium text-zinc-200" title={d.name}>
                    {d.name}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {d.pages} pages · {d.chunks} chunks
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await deleteDoc(d.id);
                    onChanged();
                  }}
                  className="text-[11px] text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  aria-label={`Delete ${d.name}`}
                >
                  delete
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        /* Chat History Tab */
        <div className="flex flex-1 flex-col overflow-hidden px-3">
          <div className="flex items-center justify-between px-2 py-2 text-[11px] uppercase tracking-wider text-zinc-500">
            <span>Recent Chats</span>
            <button
              onClick={onNewSession}
              className="text-accent hover:text-accent-soft text-xs normal-case font-medium"
            >
              + New chat
            </button>
          </div>

          <ul className="flex-1 space-y-1 overflow-y-auto pb-3">
            {displayedSessions.length === 0 && (
              <li className="px-2 py-8 text-center text-xs text-zinc-500">
                {searchQuery ? "No matching chats found." : "No saved chats yet. Start chatting!"}
              </li>
            )}
            {displayedSessions.map((session) => (
              <li
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs transition cursor-pointer ${
                  session.id === activeSessionId
                    ? "bg-ink-800 text-zinc-100 font-medium"
                    : "text-zinc-400 hover:bg-ink-800/60 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <svg
                    className={`h-3.5 w-3.5 shrink-0 ${
                      session.id === activeSessionId ? "text-accent" : "text-zinc-500"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span className="truncate" title={session.title}>
                    {session.title || "Untitled Chat"}
                  </span>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteSession(session.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition p-1"
                  title="Delete chat"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    viewBox="0 0 24 24"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer / Status */}
      <div className="border-t border-ink-700/80 bg-ink-950/40 px-3.5 py-2.5 text-xs text-zinc-400 flex items-center justify-between">
        <span className="truncate pr-2">
          {health ? (
            <span className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="truncate text-xs">
                {health.llm_provider} · <span className="font-mono text-zinc-300">{health.llm_model}</span>
              </span>
            </span>
          ) : (
            <span className="flex items-center gap-2 text-xs">
              <span className="h-2 w-2 rounded-full bg-red-400" />
              <span>API unreachable</span>
            </span>
          )}
        </span>

        {/* Clean setting button matching top bar size with no animation */}
        <button
          onClick={onSettings}
          title="Settings"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-ink-700 bg-ink-800/80 text-zinc-400 transition hover:border-zinc-500 hover:bg-ink-700 hover:text-zinc-100"
          aria-label="Settings"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            viewBox="0 0 24 24"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
