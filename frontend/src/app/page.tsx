"use client";

import { useCallback, useEffect, useState } from "react";
import Chat from "./components/Chat";
import Evaluation from "./components/Evaluation";
import Settings from "./components/Settings";
import Sidebar from "./components/Sidebar";
import VisualizationStudio from "./components/VisualizationStudio";
import { VisualizationProvider, useVisualization } from "./context/VisualizationContext";
import { Doc, Health, getHealth, listDocs } from "./lib/api";

function MainApp() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [health, setHealth] = useState<Health | null>(null);
  const [tab, setTab] = useState<"chat" | "eval">("chat");
  const [showSettings, setShowSettings] = useState(false);
  const [useGraph, setUseGraph] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { showStudio, setShowStudio } = useVisualization();

  const refreshHealth = useCallback(
    () => getHealth().then(setHealth).catch(() => setHealth(null)),
    []
  );

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
    refreshHealth();
  }, [refresh, refreshHealth]);

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-ink-950 font-sans text-zinc-100">
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          onSwitched={() => {
            setShowSettings(false);
            refreshHealth();
          }}
          useGraph={useGraph}
          onToggleGraph={setUseGraph}
        />
      )}

      {/* Collapsible Left Sidebar */}
      <div
        className={`h-full transition-all duration-300 ease-in-out shrink-0 overflow-hidden ${
          sidebarOpen ? "w-80" : "w-0"
        }`}
      >
        <div className="h-full w-80">
          <Sidebar
            docs={docs}
            selected={selected}
            health={health}
            onToggle={toggle}
            onChanged={refresh}
            onSettings={() => setShowSettings(true)}
            onCloseSidebar={() => setSidebarOpen(false)}
          />
        </div>
      </div>

      {/* Visualization studio (collapsible pane) */}
      <VisualizationStudio />

      {/* Main content area */}
      <main className="flex min-w-0 flex-1 flex-col bg-ink-950">
        {/* Professional Top Navigation Bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-ink-700/80 bg-ink-900/60 px-4 backdrop-blur-md">
          {/* Left section: Sidebar toggle + App Brand (when collapsed) */}
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Expand sidebar"
                className="group flex h-8 items-center gap-2 rounded-lg border border-ink-700 bg-ink-800/80 px-2.5 py-1 text-xs font-medium text-zinc-300 shadow-sm transition hover:border-zinc-500 hover:bg-ink-700 hover:text-white"
                aria-label="Expand sidebar"
              >
                <svg
                  className="h-4 w-4 text-zinc-400 transition-transform group-hover:scale-110"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="M9 3v18" />
                  <path d="m11 9 3 3-3 3" />
                </svg>
                <span className="hidden sm:inline">Documents</span>
              </button>
            )}

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1">
              <button
                onClick={() => setTab("chat")}
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                  tab === "chat"
                    ? "bg-accent/15 text-accent shadow-sm"
                    : "text-zinc-400 hover:bg-ink-800 hover:text-zinc-200"
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
                <span>Chat</span>
                {tab === "chat" && (
                  <span className="absolute -bottom-[9px] left-3 right-3 h-[2px] rounded-full bg-accent" />
                )}
              </button>

              <button
                onClick={() => setTab("eval")}
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition ${
                  tab === "eval"
                    ? "bg-accent/15 text-accent shadow-sm"
                    : "text-zinc-400 hover:bg-ink-800 hover:text-zinc-200"
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
                  <path d="M12 20v-6M6 20V10M18 20V4" />
                </svg>
                <span>Evaluation</span>
                {tab === "eval" && (
                  <span className="absolute -bottom-[9px] left-3 right-3 h-[2px] rounded-full bg-accent" />
                )}
              </button>

              {/* Data Studio Toggle Tab */}
              <button
                onClick={() => setShowStudio(!showStudio)}
                title={showStudio ? "Close Data Studio panel" : "Open Data Studio panel"}
                className={`relative flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  showStudio
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300 shadow-sm"
                    : "border-transparent text-zinc-400 hover:border-ink-700 hover:bg-ink-800 hover:text-zinc-200"
                }`}
              >
                <svg
                  className="h-3.5 w-3.5 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  viewBox="0 0 24 24"
                >
                  <line x1="18" x2="18" y1="20" y2="10" />
                  <line x1="12" x2="12" y1="20" y2="4" />
                  <line x1="6" x2="6" y1="20" y2="14" />
                </svg>
                <span>Data Studio</span>
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${
                    showStudio ? "bg-emerald-400" : "bg-zinc-600"
                  }`}
                />
              </button>
            </nav>
          </div>

          {/* Right section: Graph mode status / quick settings */}
          <div className="flex items-center gap-2">
            <span
              className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                useGraph
                  ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                  : "border-ink-700 bg-ink-800 text-zinc-400"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  useGraph ? "bg-violet-400 animate-pulse" : "bg-zinc-500"
                }`}
              />
              {useGraph ? "GraphRAG" : "Vector RAG"}
            </span>

            {/* Quick Settings Button on Top Bar */}
            <button
              onClick={() => setShowSettings(true)}
              title="Settings"
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ink-700 bg-ink-800/80 text-zinc-400 transition hover:border-zinc-500 hover:bg-ink-700 hover:text-zinc-100"
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
        </header>

        {/* Content body */}
        <div className="min-h-0 flex-1">
          {tab === "chat" ? (
            <Chat docIds={selected.size ? Array.from(selected) : null} hasDocs={docs.length > 0} useGraph={useGraph} />
          ) : (
            <Evaluation hasDocs={docs.length > 0} />
          )}
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <VisualizationProvider>
      <MainApp />
    </VisualizationProvider>
  );
}
