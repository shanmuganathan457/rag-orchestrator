"use client";
import { useState, useRef, useEffect } from "react";

export default function ChatPage() {
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating) return;

    const userMessage = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    setIsGenerating(true);

    try {
      const response = await fetch("http://localhost:8000/api/v1/chat/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage }),
      });

      if (!response.body) throw new Error("No body in response");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const event of events) {
          const name = event.match(/^event: (.+)$/m)?.[1];
          const raw = event.match(/^data: (.+)$/m)?.[1];
          if (!name || !raw) continue;
          try {
            const payload = JSON.parse(raw);
            if (name === "token") setMessages((prev) => { const copy = [...prev]; copy[copy.length - 1].content += payload.text ?? ""; return copy; });
            if (name === "error") { console.error(payload.message); setIsGenerating(false); }
            if (name === "done") setIsGenerating(false);
          } catch { console.error("Malformed chat stream event"); }
        }
        if (done) break;
      }
      setIsGenerating(false);    } catch (error) {
      console.error("Error fetching stream:", error);
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white shadow-sm px-6 py-4 border-b">
        <h1 className="text-xl font-semibold text-gray-800">RAG Orchestrator Chat</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full">
        <div className="space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-6 py-4 ${
                msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white shadow-sm border text-gray-800'
              }`}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}
          <div ref={endOfMessagesRef} />
        </div>
      </main>

      <div className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isGenerating}
              placeholder="Ask a question about your documents..."
              className="flex-1 px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
            <button 
              type="submit" 
              disabled={isGenerating || !input.trim()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
