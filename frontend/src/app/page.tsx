"use client";
import { useEffect, useState } from "react";

export default function Home() {
  const [health, setHealth] = useState<string>("Checking...");

  useEffect(() => {
    fetch("http://localhost:8000/api/v1/health")
      .then((res) => res.json())
      .then((data) => setHealth(data.status === "ok" ? "Connected" : "Error"))
      .catch(() => setHealth("Disconnected"));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gray-50">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm flex">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl font-bold text-gray-900">RAG Orchestrator</h1>
          <p className="text-lg text-gray-600">Advanced Retrieval-Augmented Generation Platform</p>
          <a href="/settings/providers" className="text-blue-700 hover:underline">Provider settings</a>
          <div className="mt-8 px-4 py-2 bg-white rounded-lg shadow-sm border border-gray-200">
            Backend Status: <span className={health === "Connected" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>{health}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
