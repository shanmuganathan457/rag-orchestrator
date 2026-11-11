"use client";

import { useVisualization } from "../context/VisualizationContext";
import TabBar from "./TabBar";
import TabContent from "./TabContent";

export default function VisualizationStudio() {
  const { showStudio, setShowStudio, tabs, addTab } = useVisualization();

  if (!showStudio) return null;

  // Auto-create a tab if none exist
  if (tabs.length === 0) {
    addTab();
  }

  return (
    <div className="flex h-full w-full flex-col bg-ink-950">
      {/* Studio header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-ink-700/80 bg-ink-900/40 px-4">
        <h2 className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded bg-emerald-500/15 text-[11px] text-emerald-400">
            📊
          </span>
          Data Studio
        </h2>
        <button
          onClick={() => setShowStudio(false)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-ink-800 hover:text-zinc-100 transition text-xs"
          title="Close Data Studio"
        >
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <TabBar />

      {/* Active tab content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <TabContent />
      </div>
    </div>
  );
}
