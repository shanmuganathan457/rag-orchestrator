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
    <div
      className="flex h-full flex-col border-r border-ink-700 bg-ink-950 transition-all duration-300"
      style={{ width: "50%", minWidth: 400 }}
    >
      {/* Studio header */}
      <div className="flex items-center justify-between border-b border-ink-700 px-4 py-2">
        <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/15 text-xs text-accent">📊</span>
          Data Studio
        </h2>
        <button
          onClick={() => setShowStudio(false)}
          className="rounded-lg p-1.5 text-zinc-500 hover:bg-ink-800 hover:text-zinc-200 transition text-sm"
          title="Close studio"
        >
          ✕
        </button>
      </div>

      {/* Tab bar */}
      <TabBar />

      {/* Active tab content */}
      <div className="flex-1 min-h-0">
        <TabContent />
      </div>
    </div>
  );
}
