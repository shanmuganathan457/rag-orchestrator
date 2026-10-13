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
      <div className="h-2 w-40 overflow-hidden rounded-full bg-ink-700">
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
    <div className="h-full overflow-y-auto px-6 py-8">
      <div className="mx-auto max-w-3xl">
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
              max={30}
              value={n}
              onChange={(e) => setN(Number(e.target.value))}
              className="ml-3 w-20 rounded-lg border border-ink-600 bg-ink-800 px-3 py-1.5 text-sm outline-none focus:border-accent"
            />
          </label>
          <button
            onClick={run}
            disabled={busy || !hasDocs}
            className="rounded-xl bg-accent px-5 py-2 text-sm font-medium text-ink-950 transition hover:bg-accent-soft disabled:opacity-40"
          >
            {busy ? "Running…" : "Run evaluation"}
          </button>
          {busy && <span className="text-xs text-zinc-500">Free LLM tiers are rate limited, this can take a minute.</span>}
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        {result && (
          <>
            <div className="mt-8 overflow-hidden rounded-xl border border-ink-700">
              <table className="w-full text-left text-sm">
                <thead className="bg-ink-900 text-xs uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-4 py-3">Strategy</th>
                    <th className="px-4 py-3">Hit@1</th>
                    <th className="px-4 py-3">Hit@{result.k}</th>
                    <th className="px-4 py-3">MRR</th>
                    <th className="px-4 py-3">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {modes.map((m) => {
                    const s = result.summary[m];
                    const best = s.mrr === bestMrr;
                    return (
                      <tr key={m} className="border-t border-ink-700">
                        <td className="px-4 py-3">
                          <div className="font-medium">{LABELS[m].name}</div>
                          <div className="text-xs text-zinc-500">{LABELS[m].hint}</div>
                        </td>
                        <td className="px-4 py-3"><Bar value={s.hit_at_1} best={best} /></td>
                        <td className="px-4 py-3"><Bar value={s.hit_at_5} best={best} /></td>
                        <td className="px-4 py-3 font-mono">{s.mrr.toFixed(3)}</td>
                        <td className="px-4 py-3 font-mono text-zinc-400">{s.avg_latency_ms} ms</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Based on {result.questions} generated questions.</p>

            <h3 className="mt-8 text-sm font-medium text-zinc-300">Per-question ranks of the correct passage</h3>
            <ul className="mt-3 space-y-2">
              {result.details.map((d, i) => (
                <li key={i} className="rounded-lg border border-ink-700 bg-ink-900 px-4 py-3 text-sm">
                  <div className="text-zinc-300">{d.question}</div>
                  <div className="mt-1.5 flex gap-4 font-mono text-xs text-zinc-500">
                    {Object.entries(d.ranks).map(([mode, rank]) => (
                      <span key={mode}>
                        {mode}: <span className={rank ? "text-accent" : "text-red-400"}>{rank ?? "miss"}</span>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
