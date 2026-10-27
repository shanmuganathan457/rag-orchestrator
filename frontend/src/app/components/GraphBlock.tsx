"use client";

import { useRef, useState } from "react";
import { GraphState } from "../context/VisualizationContext";
import ChartCard from "./ChartCard";
import AiChartChat from "./AiChartChat";

type Props = {
  graph: GraphState;
  data: Record<string, string | number>[];
  columns: string[];
  allSeriesKeys: string[];
  onUpdate: (upd: Partial<GraphState>) => void;
  onDelete: () => void;
  canDelete: boolean;
};

export default function GraphBlock({ graph, data, columns, allSeriesKeys, onUpdate, onDelete, canDelete }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);

  return (
    <div className="space-y-3">
      {/* Chart */}
      <div className="relative">
        {canDelete && (
          <button
            onClick={onDelete}
            className="absolute -top-1 -right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink-900 border border-ink-600 text-zinc-500 hover:text-red-400 hover:border-red-400 transition text-[10px]"
            title="Remove this graph"
          >
            ×
          </button>
        )}
        <div ref={chartRef} data-chart-block={graph.id}>
          <ChartCard
            data={data}
            columns={columns}
            chartType={graph.chartType}
            title={graph.title || ""}
            onChartTypeChange={(t) => onUpdate({ chartType: t })}
            visibleColumns={graph.visibleColumns}
            onVisibleColumnsChange={(cols) => onUpdate({ visibleColumns: cols })}
          />
        </div>
      </div>

      {/* AI Chat for this graph */}
      <AiChartChat
        columns={columns}
        allSeriesKeys={allSeriesKeys}
        currentChartType={graph.chartType}
        currentVisibleColumns={graph.visibleColumns || allSeriesKeys}
        onApplyConfig={(cfg) => {
          const upd: Partial<GraphState> = {};
          if (cfg.chartType) upd.chartType = cfg.chartType;
          if (cfg.visibleColumns) upd.visibleColumns = cfg.visibleColumns;
          if (cfg.title) upd.title = cfg.title;
          onUpdate(upd);
        }}
      />
    </div>
  );
}
