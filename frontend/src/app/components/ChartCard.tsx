"use client";

import { useRef, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import html2canvas from "html2canvas";

type ChartType = "bar" | "line" | "scatter";

type Props = {
  data: Record<string, string | number>[];
  columns: string[];
  chartType: ChartType;
  title: string;
  onChartTypeChange: (t: ChartType) => void;
  visibleColumns?: string[];
  onVisibleColumnsChange?: (cols: string[]) => void;
};

const COLORS = ["#7c9cff", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb923c", "#22d3ee", "#e879f9"];

export default function ChartCard({
  data, columns, chartType, title, onChartTypeChange,
  visibleColumns, onVisibleColumnsChange,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showColPicker, setShowColPicker] = useState(false);

  const xKey = columns[0] || "x";
  const allSeriesKeys = columns.slice(1).filter((c) =>
    data.some((row) => typeof row[c] === "number")
  );

  // If visibleColumns is provided, filter; otherwise show all
  const seriesKeys = visibleColumns
    ? allSeriesKeys.filter((k) => visibleColumns.includes(k))
    : allSeriesKeys;

  function toggleColumn(col: string) {
    if (!onVisibleColumnsChange) return;
    const current = visibleColumns || allSeriesKeys;
    const next = current.includes(col)
      ? current.filter((c) => c !== col)
      : [...current, col];
    onVisibleColumnsChange(next);
  }

  async function copyChart() {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: "#0f0f14" });
      canvas.toBlob(async (blob) => {
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      });
    } catch {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function renderChart() {
    if (seriesKeys.length === 0) {
      return <p className="text-sm text-zinc-500 py-8 text-center">No columns selected for charting. Use the column picker above.</p>;
    }

    const commonProps = { data, margin: { top: 10, right: 20, left: 0, bottom: 5 } };

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={340}>
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
            <Tooltip contentStyle={{ background: "#1a1a24", border: "1px solid #2a2a35", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {seriesKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "scatter") {
      return (
        <ResponsiveContainer width="100%" height={340}>
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#71717a" }} />
            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
            <Tooltip contentStyle={{ background: "#1a1a24", border: "1px solid #2a2a35", borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {seriesKeys.map((key, i) => (
              <Scatter key={key} name={key} dataKey={key} fill={COLORS[i % COLORS.length]} />
            ))}
          </ScatterChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={340}>
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#71717a" }} />
          <YAxis tick={{ fontSize: 11, fill: "#71717a" }} />
          <Tooltip contentStyle={{ background: "#1a1a24", border: "1px solid #2a2a35", borderRadius: 8, fontSize: 12 }} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          {seriesKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-800/50 p-4">
      {/* Header toolbar */}
      <div className="mb-3 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-zinc-200 truncate">{title}</h3>
        <div className="flex items-center gap-2">
          {/* Column picker toggle */}
          <button
            onClick={() => setShowColPicker(!showColPicker)}
            className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
              showColPicker ? "bg-accent/15 text-accent" : "text-zinc-500 hover:text-zinc-300 hover:bg-ink-700"
            }`}
            title="Select columns"
          >
            Columns
          </button>
          <span className="w-px h-4 bg-ink-600" />
          {/* Chart type selectors */}
          {(["bar", "line", "scatter"] as ChartType[]).map((t) => (
            <button
              key={t}
              onClick={() => onChartTypeChange(t)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                chartType === t
                  ? "bg-accent/15 text-accent"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-ink-700"
              }`}
            >
              {t}
            </button>
          ))}
          <span className="w-px h-4 bg-ink-600" />
          <button
            onClick={copyChart}
            className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-ink-700 transition"
            title="Copy chart"
          >
            {copied ? "✓ Copied" : "⎘ Copy"}
          </button>
        </div>
      </div>

      {/* Column picker dropdown */}
      {showColPicker && (
        <div className="mb-3 flex flex-wrap gap-1.5 rounded-lg border border-ink-700 bg-ink-900 p-2.5">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider w-full mb-1">Toggle columns to plot:</span>
          {allSeriesKeys.map((col, i) => {
            const active = seriesKeys.includes(col);
            return (
              <button
                key={col}
                onClick={() => toggleColumn(col)}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                  active
                    ? "border-transparent text-white"
                    : "border-ink-600 text-zinc-600 hover:text-zinc-400"
                }`}
                style={active ? { backgroundColor: COLORS[i % COLORS.length] + "30", borderColor: COLORS[i % COLORS.length] } : {}}
              >
                {col}
              </button>
            );
          })}
          <button
            onClick={() => onVisibleColumnsChange?.(allSeriesKeys)}
            className="rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition ml-auto"
          >
            Select All
          </button>
          <button
            onClick={() => onVisibleColumnsChange?.([])}
            className="rounded-md px-2 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition"
          >
            Clear
          </button>
        </div>
      )}

      {/* Chart */}
      <div ref={chartRef}>
        {renderChart()}
      </div>
    </div>
  );
}
