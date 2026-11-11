"use client";

import { useState } from "react";
import { EvalResult, runEval } from "../lib/api";

const LABELS: Record<string, { name: string; hint: string }> = {
  vector: { name: "Vector", hint: "Semantic similarity (pgvector, bge-small)" },
  keyword: { name: "Keyword", hint: "Postgres full-text search (BM25-style)" },
  hybrid: { name: "Hybrid (RRF)", hint: "Reciprocal Rank Fusion of both" },
};

function Bar({ value, best }: { value: number; best: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-2 w-48 overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full rounded-full ${best ? "bg-accent" : "bg-zinc-500"}`}
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="w-12 font-mono text-sm">{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function Evaluation({ hasDocs }: { hasDocs: boolean }) {
  const [n, setN] = useState(8);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      setResult(await runEval(n));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const modes = result ? (Object.keys(result.summary) as (keyof EvalResult["summary"])[]) : [];
  const bestMrr = result ? Math.max(...modes.map((m) => result.summary[m].mrr)) : 0;

  return (
    <div className="h-full w-full overflow-y-auto px-4 sm:px-8 lg:px-12 py-8">
      <div className="w-full">
        <h2 className="text-2xl font-semibold tracking-tight">Retrieval evaluation</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          Samples random passages from your documents, has the LLM write a question for each, then checks whether
          each retrieval strategy finds the original passage. This turns &quot;it seems to work&quot; into numbers.
        </p>

        <div className="mt-6 flex items-center gap-4">
          <label className="text-sm text-zinc-400">
            Questions
            <input
              type="number"
              min={2}
              max={20}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="ml-2 w-16 rounded-md border border-ink-600 bg-ink-800 px-2 py-1 text-center font-mono text-sm text-zinc-100"
            />
          </label>
          <button
            onClick={run}
            disabled={busy || !hasDocs}
            className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-ink-950 transition hover:bg-accent-soft disabled:opacity-40"
          >
            {busy ? "Evaluating…" : "Run evaluation"}
          </button>
        </div>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {result && (
          <div className="mt-8 space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {modes.map((mode) => {
                const s = result.summary[mode];
                const isBest = s.mrr === bestMrr && bestMrr > 0;
                return (
                  <div
                    key={mode}
                    className={`rounded-xl border p-5 transition ${
                      isBest ? "border-accent/60 bg-accent/5 shadow-md" : "border-ink-700 bg-ink-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-zinc-100">{LABELS[mode]?.name ?? mode}</span>
                      {isBest && (
                        <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
                          Best
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-zinc-400">{LABELS[mode]?.hint}</p>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Hit @ 1</span>
                        <Bar value={s.hit_at_1} best={isBest} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-400">
                        <span>Hit @ 5</span>
                        <Bar value={s.hit_at_5} best={isBest} />
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-ink-700/60 pt-3 text-xs">
                      <span className="text-zinc-400">MRR: <strong className="text-zinc-200">{s.mrr.toFixed(3)}</strong></span>
                      <span className="text-zinc-500 font-mono">{s.avg_latency_ms.toFixed(0)} ms</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detailed per-question table */}
            <div className="rounded-xl border border-ink-700 bg-ink-900 overflow-hidden">
              <div className="border-b border-ink-700/80 px-4 py-3 font-medium text-xs text-zinc-300">
                Detailed results ({result.details.length} questions)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-ink-950/60 text-zinc-400 border-b border-ink-700/60">
                    <tr>
                      <th className="px-4 py-2.5 font-medium">Synthetic Question</th>
                      <th className="px-4 py-2.5 font-medium text-center">Vector Rank</th>
                      <th className="px-4 py-2.5 font-medium text-center">Keyword Rank</th>
                      <th className="px-4 py-2.5 font-medium text-center">Hybrid Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-700/50">
                    {result.details.map((d, i) => (
                      <tr key={i} className="hover:bg-ink-800/50 transition">
                        <td className="px-4 py-3 text-zinc-200 max-w-md">{d.question}</td>
                        <td className="px-4 py-3 text-center font-mono">
                          {d.ranks.vector !== null ? (
                            <span className={d.ranks.vector === 1 ? "text-emerald-400 font-semibold" : "text-zinc-300"}>
                              #{d.ranks.vector}
                            </span>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {d.ranks.keyword !== null ? (
                            <span className={d.ranks.keyword === 1 ? "text-emerald-400 font-semibold" : "text-zinc-300"}>
                              #{d.ranks.keyword}
                            </span>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {d.ranks.hybrid !== null ? (
                            <span className={d.ranks.hybrid === 1 ? "text-emerald-400 font-semibold" : "text-zinc-300"}>
                              #{d.ranks.hybrid}
                            </span>
                          ) : (
                            <span className="text-zinc-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
