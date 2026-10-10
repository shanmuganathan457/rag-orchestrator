"use client";

import { useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type ModeMetrics = {
  hit_at_1: number;
  hit_at_5: number;
  mrr: number;
  avg_latency_ms: number;
};

type EvaluationDetail = {
  chunk_id: string;
  document_id: string;
  question: string;
  ranks: Record<string, number | null>;
};

type EvaluationResult = {
  total_evaluated: number;
  top_k: number;
  summary: Record<string, ModeMetrics>;
  details: EvaluationDetail[];
};

export default function EvaluationPage() {
  const [sampleSize, setSampleSize] = useState(10);
  const [topK, setTopK] = useState(5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runEvaluation = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/evaluation/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample_size: sampleSize, top_k: topK }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Evaluation run failed.");
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <a href="/" className="text-xs font-semibold uppercase tracking-wider text-indigo-400 hover:underline">
              ← RAG Orchestrator Dashboard
            </a>
            <h1 className="text-3xl font-extrabold text-white mt-1">Retrieval Quality Benchmark</h1>
            <p className="text-slate-400 text-sm mt-1">
              Automated synthetic question generation & comparative benchmarking across Vector, Keyword, and Hybrid (RRF) retrieval.
            </p>
          </div>
        </header>

        <form onSubmit={runEvaluation} className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700 p-6 shadow-xl flex flex-wrap items-end gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Sample Passages Count</label>
            <input
              type="number"
              min={1}
              max={50}
              value={sampleSize}
              onChange={(e) => setSampleSize(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Top-K Evaluation Threshold</label>
            <input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white w-36 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold px-6 py-2.5 rounded-lg shadow-lg disabled:opacity-50 transition duration-200"
          >
            {loading ? "Benchmarking Retrieval..." : "Run Evaluation Suite"}
          </button>
        </form>

        {error && (
          <div className="bg-red-950/80 border border-red-800 rounded-xl p-4 text-red-200 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-white">Comparative Performance</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(result.summary).map(([mode, metrics]) => (
                <div
                  key={mode}
                  className={`rounded-2xl border p-6 shadow-lg bg-slate-800/60 backdrop-blur ${
                    mode === "hybrid" ? "border-indigo-500/80 ring-2 ring-indigo-500/30" : "border-slate-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold capitalize text-white">{mode} Search</h3>
                    {mode === "hybrid" && (
                      <span className="bg-indigo-500/20 text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full border border-indigo-500/40">
                        Recommended
                      </span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm border-b border-slate-700/60 pb-2">
                      <span className="text-slate-400">Hit@1 (Top Rank)</span>
                      <span className="font-semibold text-emerald-400">{(metrics.hit_at_1 * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-700/60 pb-2">
                      <span className="text-slate-400">Hit@{result.top_k}</span>
                      <span className="font-semibold text-emerald-400">{(metrics.hit_at_5 * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm border-b border-slate-700/60 pb-2">
                      <span className="text-slate-400">MRR (Reciprocal Rank)</span>
                      <span className="font-semibold text-indigo-300">{metrics.mrr.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm pt-1">
                      <span className="text-slate-400">Avg Latency</span>
                      <span className="font-mono text-amber-300">{metrics.avg_latency_ms} ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xl font-bold text-white">Generated Test Questions & Ranks</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-300">
                  <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Passage Chunk ID</th>
                      <th className="py-3 px-4">Generated Question</th>
                      <th className="py-3 px-4 text-center">Vector Rank</th>
                      <th className="py-3 px-4 text-center">Keyword Rank</th>
                      <th className="py-3 px-4 text-center">Hybrid Rank</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {result.details.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-mono text-xs text-indigo-300">#{item.chunk_id}</td>
                        <td className="py-3 px-4 text-white max-w-md">{item.question}</td>
                        <td className="py-3 px-4 text-center font-mono">{item.ranks.vector ?? "—"}</td>
                        <td className="py-3 px-4 text-center font-mono">{item.ranks.keyword ?? "—"}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">{item.ranks.hybrid ?? "—"}</td>
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
