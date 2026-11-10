"use client";

import { useEffect, useState } from "react";
import { ProviderInfo, getProviders, switchProvider } from "../lib/api";

const PROVIDERS = ["ollama", "gemini", "groq", "openrouter", "openai-compatible"];

const DEFAULT_MODELS: Record<string, string> = {
  ollama: "llama3.2:latest",
  gemini: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "openai/gpt-4o-mini",
  "openai-compatible": "gpt-4o-mini",
};

const NEEDS_KEY = ["gemini", "groq", "openrouter", "openai-compatible"];
const NEEDS_URL = ["ollama", "openai-compatible"];

type Status = { ok: boolean; msg: string } | null;

export default function Settings({ onClose, onSwitched, useGraph, onToggleGraph }: {
  onClose: () => void;
  onSwitched: () => void;
  useGraph: boolean;
  onToggleGraph: (v: boolean) => void;
}) {
  const [info, setInfo] = useState<ProviderInfo | null>(null);
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("llama3.2:latest");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434/v1");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    getProviders()
      .then((p) => {
        setInfo(p);
        setProvider(p.provider);
        setModel(p.model);
        if (p.base_url) setBaseUrl(p.base_url);
      })
      .catch(() => {});
  }, []);

  function handleProviderChange(p: string) {
    setProvider(p);
    setModel(DEFAULT_MODELS[p] ?? "");
    setStatus(null);
    if (p === "ollama") setBaseUrl("http://localhost:11434/v1");
  }

  async function handleSave() {
    setSaving(true);
    setStatus(null);
    try {
      await switchProvider({
        provider,
        model,
        api_key: apiKey || undefined,
        base_url: NEEDS_URL.includes(provider) ? baseUrl : undefined,
      });
      setStatus({ ok: true, msg: `Switched to ${provider} · ${model}` });
      onSwitched();
    } catch (e) {
      setStatus({ ok: false, msg: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    /* Overlay */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl border border-ink-700 bg-ink-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">LLM Provider Settings</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">✕</button>
        </div>

        {/* Current */}
        {info && (
          <p className="mb-4 rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-xs text-zinc-400">
            <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 align-middle" />
            Currently: <strong className="text-zinc-200">{info.provider}</strong> ·{" "}
            <span className="font-mono">{info.model}</span>
          </p>
        )}

        <div className="space-y-4">
          {/* Provider selector */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Provider</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PROVIDERS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleProviderChange(p)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    provider === p
                      ? "border-accent bg-accent/10 text-accent-soft"
                      : "border-ink-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Model */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">Model</label>
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g. llama3.2:latest"
              className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm outline-none transition focus:border-accent"
            />
          </div>

          {/* API Key */}
          {NEEDS_KEY.includes(provider) && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                API Key <span className="text-red-400">*</span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-… or AIza…"
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-mono outline-none transition focus:border-accent"
              />
              <p className="mt-1 text-xs text-zinc-500">
                {provider === "gemini" && "Get free key → aistudio.google.com/apikey"}
                {provider === "groq" && "Get free key → console.groq.com/keys"}
                {provider === "openrouter" && "Get key → openrouter.ai/keys"}
                {provider === "openai-compatible" && "API key for your endpoint"}
              </p>
            </div>
          )}

          {/* Base URL */}
          {NEEDS_URL.includes(provider) && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Base URL</label>
              <input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
                className="w-full rounded-lg border border-ink-700 bg-ink-800 px-3 py-2 text-sm font-mono outline-none transition focus:border-accent"
              />
            </div>
          )}

          {/* Status message */}
          {status && (
            <p className={`rounded-lg px-3 py-2 text-xs ${status.ok ? "bg-emerald-950 text-emerald-400" : "bg-red-950 text-red-400"}`}>
              {status.ok ? "✓ " : "✗ "}{status.msg}
            </p>
          )}

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || !model.trim()}
            className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-ink-950 transition hover:bg-accent-soft disabled:opacity-40"
          >
            {saving ? "Testing & Switching…" : "Apply Provider"}
          </button>
          <p className="text-center text-xs text-zinc-500">
            Connection is tested before switching. No restart needed.
          </p>

          {/* ── GraphRAG Toggle ──────────────────────────────── */}
          <div className="mt-2 flex items-center justify-between rounded-xl border border-ink-700 bg-ink-800 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-zinc-200">GraphRAG Mode</p>
              <p className="text-xs text-zinc-500">
                {useGraph
                  ? "Knowledge graph + vector search (richer multi-hop reasoning)"
                  : "Standard vector RAG (fast, no graph)"}
              </p>
            </div>
            <button
              onClick={() => onToggleGraph(!useGraph)}
              className={`relative ml-4 h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none ${
                useGraph ? "bg-accent" : "bg-zinc-700"
              }`}
              aria-label="Toggle GraphRAG"
            >
              <span
                className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  useGraph ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
