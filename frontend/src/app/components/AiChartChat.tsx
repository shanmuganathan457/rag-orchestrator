"use client";

import { useState } from "react";
import { API } from "../lib/api";

type ChartType = "bar" | "line" | "scatter";

type AiChartConfig = {
  chartType?: ChartType;
  visibleColumns?: string[];
  title?: string;
  explanation?: string;
};

type Props = {
  columns: string[];
  allSeriesKeys: string[];
  currentChartType: ChartType;
  currentVisibleColumns: string[];
  onApplyConfig: (cfg: AiChartConfig) => void;
};

export default function AiChartChat({ columns, allSeriesKeys, currentChartType, currentVisibleColumns, onApplyConfig }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);

  async function handleSend() {
    const query = input.trim();
    if (!query || loading) return;

    setInput("");
    setMessages((m) => [...m, { role: "user", text: query }]);
    setLoading(true);

    try {
      // Build a prompt that asks the LLM to return JSON config
      const systemPrompt = `You are a data visualization assistant. The user has a dataset with these columns: ${JSON.stringify(columns)}.
The numeric columns available for charting are: ${JSON.stringify(allSeriesKeys)}.
The current chart type is "${currentChartType}" and visible columns are ${JSON.stringify(currentVisibleColumns)}.

When the user asks to modify the chart, respond ONLY with valid JSON in this exact format:
{
  "chartType": "bar" | "line" | "scatter",
  "visibleColumns": ["col1", "col2"],
  "title": "optional chart title",
  "explanation": "brief explanation of what you changed"
}

Rules:
- Only include columns that exist in the available numeric columns list.
- If the user doesn't mention chart type, keep the current one.
- If the user says "show all", include all numeric columns.
- Always include "explanation" with a brief description.
- Respond ONLY with JSON, no markdown, no code blocks, no extra text.`;

      const response = await fetch(`${API}/api/v1/chat/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `${systemPrompt}\n\nUser request: ${query}`,
          history: [],
          document_ids: null,
        }),
      });

      if (!response.ok || !response.body) throw new Error("AI request failed");

      // Read SSE stream and collect full answer
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullAnswer = "";

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
          if (event === "token" && dataStr) {
            try {
              const parsed = JSON.parse(dataStr);
              fullAnswer += typeof parsed === "string" ? parsed : (parsed.text || "");
            } catch { /* skip */ }
          }
        }
      }

      // Try to parse JSON from the answer
      let config: AiChartConfig | null = null;
      try {
        // Extract JSON from potential markdown wrapping
        const jsonMatch = fullAnswer.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          config = JSON.parse(jsonMatch[0]) as AiChartConfig;
        }
      } catch {
        // If we can't parse JSON, show the raw answer
      }

      if (config && (config.chartType || config.visibleColumns)) {
        // Validate columns exist
        if (config.visibleColumns) {
          config.visibleColumns = config.visibleColumns.filter((c) => allSeriesKeys.includes(c));
        }
        onApplyConfig(config);
        setMessages((m) => [...m, {
          role: "ai",
          text: config!.explanation || `Applied: ${config!.chartType || currentChartType} chart with ${(config!.visibleColumns || currentVisibleColumns).join(", ")}`,
        }]);
      } else {
        setMessages((m) => [...m, {
          role: "ai",
          text: fullAnswer || "I couldn't understand that request. Try something like 'show only Buying Price and Profit as a bar chart'.",
        }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "ai", text: `Error: ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-no-export className="rounded-xl border border-ink-700 bg-ink-800/50 overflow-hidden">
      <div className="px-3 py-2 border-b border-ink-700 flex items-center gap-2">
        <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">🤖 AI Chart Assistant</span>
        <span className="text-[10px] text-zinc-600">Ask to customize columns, chart type, or analyze data</span>
      </div>

      {/* Message history */}
      {messages.length > 0 && (
        <div className="max-h-[160px] overflow-y-auto p-3 space-y-2">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-xs rounded-lg px-3 py-2 ${
                m.role === "user"
                  ? "bg-accent/10 text-accent ml-8"
                  : "bg-ink-900 text-zinc-300 mr-8"
              }`}
            >
              {m.text}
            </div>
          ))}
          {loading && (
            <div className="text-xs text-zinc-500 flex items-center gap-2 mr-8">
              <div className="h-3 w-3 animate-spin rounded-full border border-accent border-t-transparent" />
              Thinking…
            </div>
          )}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-2 border-t border-ink-700">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder='e.g. "Show only Buying Price and Profit as a bar chart"'
          className="flex-1 bg-transparent text-xs text-zinc-300 outline-none placeholder:text-zinc-600 px-2 py-1.5"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="rounded-lg bg-accent/15 px-3 py-1.5 text-[11px] font-medium text-accent transition hover:bg-accent/25 disabled:opacity-40"
        >
          Send
        </button>
      </div>
    </div>
  );
}
