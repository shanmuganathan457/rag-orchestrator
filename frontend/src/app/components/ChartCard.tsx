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
};

const COLORS = ["#7c9cff", "#f472b6", "#34d399", "#fbbf24", "#a78bfa", "#fb923c"];

export default function ChartCard({ data, columns, chartType, title, onChartTypeChange }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Use first column as X axis, rest as data series
  const xKey = columns[0] || "x";
  const seriesKeys = columns.slice(1).filter((c) =>
    data.some((row) => typeof row[c] === "number")
  );

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
      // Fallback: copy JSON data
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function renderChart() {
    if (seriesKeys.length === 0) {
      return <p className="text-sm text-zinc-500 py-8 text-center">No numeric columns found for charting.</p>;
    }

    const commonProps = { data, margin: { top: 10, right: 20, left: 0, bottom: 5 } };

    if (chartType === "line") {
      return (
        <ResponsiveContainer width="100%" height={320}>
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
        <ResponsiveContainer width="100%" height={320}>
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

    // Default: bar
    return (
      <ResponsiveContainer width="100%" height={320}>
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
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200 truncate">{title}</h3>
        <div className="flex items-center gap-2">
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
          {/* Copy button */}
          <button
            onClick={copyChart}
            className="rounded-md px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-ink-700 transition"
            title="Copy chart"
          >
            {copied ? "✓" : "⎘"}
          </button>
        </div>
      </div>
      {/* Chart */}
      <div ref={chartRef}>
        {renderChart()}
      </div>
    </div>
  );
}
