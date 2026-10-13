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
    throw new Error(body.detail ?? `Request failed (${res.status})`);
  }
  return res.json();
}

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
    body: JSON.stringify({ query: question, history, doc_ids: docIds }),
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
      const data = /^data: (.*)$/m.exec(raw)?.[1];
      if (!event || data === undefined) continue;
      const parsed = JSON.parse(data);
      if (event === "done") yield { type: "done" };
      else if (event === "sources" || event === "token" || event === "error")
        yield { type: event, data: parsed } as ChatEvent;
    }
  }
}
