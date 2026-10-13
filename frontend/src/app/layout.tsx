import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RAG Orchestrator · Chat with your documents",
  description: "Retrieval-augmented Q&A with hybrid search, citations and a built-in evaluation dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
