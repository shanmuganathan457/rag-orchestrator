"use client";

import { useEffect, useRef, useState } from "react";
import { useVisualization } from "../context/VisualizationContext";
import { CsvFileInfo, DatasetPayload, listCsvFiles, getVisualizationData } from "../lib/api";
import ChartCard from "./ChartCard";
import ExportToolbar from "./ExportToolbar";
import AiChartChat from "./AiChartChat";

export default function TabContent() {
  const { tabs, activeTabId, updateTab } = useVisualization();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const contentRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const [csvFiles, setCsvFiles] = useState<CsvFileInfo[]>([]);
  const [datasets, setDatasets] = useState<DatasetPayload[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[] | undefined>(undefined);

  useEffect(() => {
    listCsvFiles().then(setCsvFiles).catch(() => setCsvFiles([]));
  }, []);

  useEffect(() => {
    if (!activeTab || activeTab.datasets.length === 0) {
      setDatasets([]);
      return;
    }
    setLoading(true);
    setError(null);
    getVisualizationData(activeTab.datasets)
      .then((r) => {
        setDatasets(r.datasets);
        setVisibleColumns(undefined); // reset on dataset change
      })
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [activeTab?.datasets]);

  if (!activeTab) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Create a sheet tab to get started.
      </div>
    );
  }

  function toggleDataset(id: number) {
    if (!activeTab) return;
    const current = activeTab.datasets;
    const next = current.includes(id) ? current.filter((d) => d !== id) : [...current, id];
    updateTab(activeTab.id, { datasets: next });
  }

  // Merge datasets
  const mergedData: Record<string, string | number>[] = [];
  const mergedColumns: string[] = [];

  if (datasets.length === 1) {
    mergedData.push(...datasets[0].rows);
    mergedColumns.push(...datasets[0].columns);
  } else if (datasets.length > 1) {
    const allCols = new Set<string>();
    datasets.forEach((d) => d.columns.forEach((c) => allCols.add(c)));
    mergedColumns.push(...Array.from(allCols));

    const maxRows = Math.max(...datasets.map((d) => d.rows.length));
    for (let i = 0; i < maxRows; i++) {
      const row: Record<string, string | number> = {};
      datasets.forEach((d) => {
        if (d.rows[i]) {
          Object.entries(d.rows[i]).forEach(([k, v]) => {
            const colKey = datasets.length > 1 && d.columns.indexOf(k) > 0
              ? `${d.name.replace(/\.csv$/i, "")}_${k}`
              : k;
            row[colKey] = v;
          });
        }
      });
      mergedData.push(row);
    }

    if (datasets.length > 1) {
      mergedColumns.length = 0;
      const firstXCol = datasets[0]?.columns[0] || "x";
      mergedColumns.push(firstXCol);
      datasets.forEach((d) => {
        d.columns.slice(1).forEach((c) => {
          mergedColumns.push(`${d.name.replace(/\.csv$/i, "")}_${c}`);
        });
      });
    }
  }

  const allSeriesKeys = mergedColumns.slice(1).filter((c) =>
    mergedData.some((row) => typeof row[c] === "number")
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar: dataset selector + export */}
      <div className="flex items-center justify-between border-b border-ink-700 px-4 py-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider shrink-0">Datasets:</span>
          {csvFiles.length === 0 && (
            <span className="text-xs text-zinc-600">No CSV files uploaded yet.</span>
          )}
          {csvFiles.map((f) => (
            <button
              key={f.id}
              onClick={() => toggleDataset(f.id)}
              className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition whitespace-nowrap ${
                activeTab.datasets.includes(f.id)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-ink-600 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300"
              }`}
            >
              {f.name}
            </button>
          ))}
        </div>
        <ExportToolbar
          targetRef={contentRef}
          chartRef={chartRef}
          tabName={activeTab.name}
          data={mergedData}
          columns={mergedColumns}
          notes={activeTab.notes}
          datasetNames={datasets.map((d) => d.name)}
        />
      </div>

      {/* Scrollable content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && mergedData.length > 0 && (
          <div ref={chartRef} data-chart>
            <ChartCard
              data={mergedData}
              columns={mergedColumns}
              chartType={activeTab.chartConfig.type}
              title={
                datasets.length === 1
                  ? datasets[0].name
                  : `Merged: ${datasets.map((d) => d.name).join(" + ")}`
              }
              onChartTypeChange={(t) => updateTab(activeTab.id, { chartConfig: { ...activeTab.chartConfig, type: t } })}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={setVisibleColumns}
            />
          </div>
        )}

        {!loading && !error && mergedData.length === 0 && activeTab.datasets.length > 0 && (
          <p className="text-sm text-zinc-500 py-8 text-center">No data rows found in selected files.</p>
        )}

        {/* AI Chart Chat */}
        {!loading && mergedData.length > 0 && (
          <AiChartChat
            columns={mergedColumns}
            allSeriesKeys={allSeriesKeys}
            currentChartType={activeTab.chartConfig.type}
            currentVisibleColumns={visibleColumns || allSeriesKeys}
            onApplyConfig={(cfg) => {
              if (cfg.chartType) {
                updateTab(activeTab.id, { chartConfig: { ...activeTab.chartConfig, type: cfg.chartType } });
              }
              if (cfg.visibleColumns) {
                setVisibleColumns(cfg.visibleColumns);
              }
            }}
          />
        )}

        {/* Notes section */}
        <div className="rounded-xl border border-ink-700 bg-ink-800/50 p-4">
          <h4 className="mb-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Important Notes</h4>
          <textarea
            value={activeTab.notes}
            onChange={(e) => updateTab(activeTab.id, { notes: e.target.value })}
            placeholder="Add analysis notes for this sheet…"
            className="w-full min-h-[100px] bg-transparent text-sm text-zinc-300 outline-none resize-y placeholder:text-zinc-600"
          />
        </div>

        {/* Data table preview */}
        {!loading && mergedData.length > 0 && (
          <div className="rounded-xl border border-ink-700 bg-ink-800/50 overflow-hidden">
            <h4 className="px-4 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider border-b border-ink-700">
              Data Preview ({mergedData.length} rows)
            </h4>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-ink-800">
                  <tr>
                    {mergedColumns.map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-medium text-zinc-400 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mergedData.slice(0, 50).map((row, i) => (
                    <tr key={i} className="border-t border-ink-700/50 hover:bg-ink-800/80 transition">
                      {mergedColumns.map((col) => (
                        <td key={col} className="px-3 py-1.5 text-zinc-400 whitespace-nowrap">
                          {row[col] ?? ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
