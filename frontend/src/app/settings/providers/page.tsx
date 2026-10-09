"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";
const PROVIDERS = [
  { value: "gemini", label: "Gemini", needsKey: true, needsUrl: false, description: "Google Gemini API" },
  { value: "groq", label: "Groq", needsKey: true, needsUrl: false, description: "Groq OpenAI-compatible API" },
  { value: "openrouter", label: "OpenRouter", needsKey: true, needsUrl: false, description: "OpenRouter model gateway" },
  { value: "ollama", label: "Ollama", needsKey: false, needsUrl: true, description: "Local or self-hosted Ollama server" },
  { value: "openai-compatible", label: "OpenAI-compatible", needsKey: true, needsUrl: true, description: "Custom compatible endpoint" },
] as const;

type ActiveConfig = { provider: string; model: string; base_url: string; has_api_key: boolean; supported_providers: string[] };

export default function ProviderSettingsPage() {
  const [active, setActive] = useState<ActiveConfig | null>(null);
  const [provider, setProvider] = useState("ollama");
  const [model, setModel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const selected = useMemo(() => PROVIDERS.find((item) => item.value === provider)!, [provider]);

  useEffect(() => {
    fetch(`${API_BASE}/providers/`).then(async (response) => {
      if (!response.ok) throw new Error("Unable to load active provider settings");
      return response.json();
    }).then((data: ActiveConfig) => {
      setActive(data); setProvider(data.provider); setModel(data.model); setBaseUrl(data.base_url);
    }).catch(() => setStatus({ kind: "error", text: "Could not load the active backend configuration." }));
  }, []);

  async function testConnection(event: FormEvent) {
    event.preventDefault();
    if (!model.trim() || (selected.needsKey && !apiKey.trim()) || (selected.needsUrl && !baseUrl.trim())) {
      setStatus({ kind: "error", text: "Complete the required fields before testing." }); return;
    }
    setLoading(true); setStatus(null);
    try {
      const response = await fetch(`${API_BASE}/providers/test`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider, model: model.trim(), base_url: selected.needsUrl ? baseUrl.trim() : undefined, api_key: selected.needsKey ? apiKey : undefined }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Connection test failed.");
      setStatus({ kind: "success", text: `Candidate ${data.provider} configuration connected successfully.` });
    } catch (error) {
      setStatus({ kind: "error", text: error instanceof Error ? error.message : "Connection test failed." });
    } finally { setApiKey(""); setLoading(false); }
  }

  return <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-900"><section className="mx-auto max-w-2xl space-y-6"><a className="text-sm text-blue-700 hover:underline" href="/">? RAG Orchestrator</a><div><h1 className="text-3xl font-bold">LLM provider settings</h1><p className="mt-2 text-slate-600">Test a candidate configuration through the backend. This does not change the active provider.</p></div>{active && <div className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="font-semibold">Active backend configuration</h2><dl className="mt-3 grid grid-cols-2 gap-2 text-sm"><dt className="text-slate-500">Provider</dt><dd>{active.provider}</dd><dt className="text-slate-500">Model</dt><dd>{active.model}</dd><dt className="text-slate-500">Credential configured</dt><dd>{active.has_api_key ? "Yes" : "No"}</dd></dl><p className="mt-4 text-xs text-slate-500">Change environment variables and restart the backend to change this configuration.</p></div>}<form onSubmit={testConnection} className="space-y-4 rounded-xl border bg-white p-6 shadow-sm"><label className="block text-sm font-medium">Provider<select value={provider} onChange={(e) => setProvider(e.target.value)} className="mt-1 w-full rounded border p-2">{PROVIDERS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><p className="text-sm text-slate-500">{selected.description}</p><label className="block text-sm font-medium">Model name<input value={model} onChange={(e) => setModel(e.target.value)} required className="mt-1 w-full rounded border p-2" /></label>{selected.needsUrl && <label className="block text-sm font-medium">Base URL<input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} required type="url" className="mt-1 w-full rounded border p-2" /></label>}{selected.needsKey && <label className="block text-sm font-medium">API key<input value={apiKey} onChange={(e) => setApiKey(e.target.value)} required type="password" autoComplete="off" className="mt-1 w-full rounded border p-2" /></label>}<button disabled={loading} className="rounded bg-blue-700 px-4 py-2 font-medium text-white disabled:opacity-60">{loading ? "Testing…" : "Test connection"}</button>{status && <p role="status" className={status.kind === "success" ? "text-green-700" : "text-red-700"}>{status.text}</p>}</form></section></main>;
}