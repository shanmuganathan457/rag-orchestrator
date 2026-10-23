// All API routes point to our backend at /api/v1/
export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Doc = { id: number; name: string; pages: number; chunks: number; created_at: string };
export type Source = { n: number; doc_id: number; doc_name: string; page: number; snippet: string; score: number };
export type Msg = { role: "user" | "assistant"; content: string; sources?: Source[]; error?: string };
export type Health = { status: string; llm_provider: string; llm_model: string };

export type EvalMode = { hit_at_1: number; hit_at_5: number; mrr: number; avg_latency_ms: number };
export type EvalResult = {
  questions: number;
  k: number;
  summary: Record<"vector" | "keyword" | "hybrid", EvalMode>;
  details: { question: string; ranks: Record<string, number | null> }[];
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export type ProviderInfo = {
  provider: string;
  model: string;
  base_url: string | null;
  has_api_key: boolean;
  supported_providers: string[];
};

export const getProviders = () =>
  fetch(`${API}/api/v1/providers/`).then((r) => json<ProviderInfo>(r));

export const switchProvider = (data: {
  provider: string;
  model: string;
  api_key?: string;
  base_url?: string;
}) =>
  fetch(`${API}/api/v1/providers/switch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => json<{ success: boolean; provider: string; model: string }>(r));

export const testProvider = (data: {
  provider: string;
  model: string;
  api_key?: string;
  base_url?: string;
}) =>
  fetch(`${API}/api/v1/providers/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  }).then((r) => json<{ success: boolean }>(r));


export const getHealth = () => fetch(`${API}/api/v1/health/`).then((r) => json<Health>(r));
export const listDocs = () => fetch(`${API}/api/v1/documents/`).then((r) => json<Doc[]>(r));
export const deleteDoc = (id: number) => fetch(`${API}/api/v1/documents/${id}`, { method: "DELETE" });

export function uploadDoc(file: File) {
  const form = new FormData();
  form.append("file", file);
  return fetch(`${API}/api/v1/documents/`, { method: "POST", body: form }).then((r) => json<Doc>(r));
}

export const runEval = (n: number) =>
  fetch(`${API}/api/v1/evaluation/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sample_size: n, top_k: 5 }),
  }).then((r) => json<EvalResult>(r));

export type ChatEvent =
  | { type: "sources"; data: Source[] }
  | { type: "token"; data: string }
  | { type: "error"; data: string }
  | { type: "done" };

/** Map a backend source object → frontend Source type */
function mapSource(s: Record<string, unknown>, idx: number): Source {
  return {
    n: typeof s.id === "number" ? s.id : idx + 1,
    doc_id: (s.document_id ?? s.doc_id ?? 0) as number,
    doc_name: (s.document_name ?? s.doc_name ?? "") as string,
    page: (s.page ?? 0) as number,
    snippet: (s.excerpt ?? s.snippet ?? "") as string,
    score: (s.rrf_score ?? s.score ?? 0) as number,
  };
}

/** Streams server-sent events from POST /api/v1/chat/ */
export async function* streamChat(
  question: string,
  history: { role: string; content: string }[],
  docIds: number[] | null,
  signal?: AbortSignal
): AsyncGenerator<ChatEvent> {
  const res = await fetch(`${API}/api/v1/chat/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    // Backend field is document_ids (not doc_ids)
    body: JSON.stringify({ query: question, history, document_ids: docIds }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Chat failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = /^event: (.*)$/m.exec(raw)?.[1];
      const dataStr = /^data: (.*)$/m.exec(raw)?.[1];
      if (!event || dataStr === undefined) continue;

      let parsed: unknown;
      try { parsed = JSON.parse(dataStr); } catch { continue; }

      if (event === "done") {
        yield { type: "done" };
      } else if (event === "sources") {
        // Backend: { sources: [...] }  OR  plain array
        const arr: Record<string, unknown>[] = Array.isArray(parsed)
          ? (parsed as Record<string, unknown>[])
          : ((parsed as { sources?: unknown[] }).sources ?? []) as Record<string, unknown>[];
        yield { type: "sources", data: arr.map(mapSource) };
      } else if (event === "token") {
        // Backend: { text: "..." }  OR  plain string
        const text =
          typeof parsed === "string"
            ? parsed
            : typeof (parsed as { text?: unknown }).text === "string"
            ? (parsed as { text: string }).text
            : String(parsed);
        yield { type: "token", data: text };
      } else if (event === "error") {
        const msg =
          typeof parsed === "string"
            ? parsed
            : ((parsed as { message?: string; detail?: string }).message ??
              (parsed as { message?: string; detail?: string }).detail ??
              "Unknown error");
        yield { type: "error", data: msg };
      }
    }
  }
}
