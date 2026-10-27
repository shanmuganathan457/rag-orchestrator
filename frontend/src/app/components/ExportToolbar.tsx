"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { GraphState } from "../context/VisualizationContext";

type Props = {
  contentRef: React.RefObject<HTMLDivElement | null>;
  tabName: string;
  graphs: GraphState[];
  notes?: string;
  datasetNames?: string[];
};

export default function ExportToolbar({ contentRef, tabName, graphs, notes, datasetNames }: Props) {
  const [exporting, setExporting] = useState(false);

  async function exportPDF() {
    if (!contentRef.current) return;
    setExporting(true);

    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const cw = pw - margin * 2;
      let y = margin;

      const addFooter = (pageNum: number, total: number) => {
        pdf.setFontSize(8);
        pdf.setTextColor(160);
        pdf.text(`Page ${pageNum} of ${total}`, pw / 2, ph - 10, { align: "center" });
        pdf.setTextColor(180);
        pdf.text("RAG Orchestrator · Data Studio", margin, ph - 10);
      };

      const ensureSpace = (need: number) => {
        if (y + need > ph - 20) {
          pdf.addPage();
          y = margin;
        }
      };

      // ── TITLE SECTION ──
      pdf.setFillColor(18, 18, 28);
      pdf.rect(0, 0, pw, 50, "F");

      pdf.setFontSize(24);
      pdf.setTextColor(255);
      pdf.setFont("helvetica", "bold");
      pdf.text(tabName || "Data Analysis Report", margin, 28);

      pdf.setFontSize(10);
      pdf.setTextColor(160);
      pdf.setFont("helvetica", "normal");
      const dateStr = new Date().toLocaleString("en-IN", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      pdf.text(`Generated on ${dateStr}`, margin, 38);

      if (datasetNames && datasetNames.length > 0) {
        pdf.text(`Datasets: ${datasetNames.join(", ")}`, margin, 45);
      }

      y = 58;

      // Accent line
      pdf.setDrawColor(124, 156, 255);
      pdf.setLineWidth(0.6);
      pdf.line(margin, y - 2, pw - margin, y - 2);
      y += 4;

      // ── GRAPH SECTIONS ──
      // Find all chart block elements in the DOM
      const chartEls = contentRef.current.querySelectorAll("[data-chart-block]");

      for (let i = 0; i < chartEls.length; i++) {
        const el = chartEls[i] as HTMLElement;
        const graph = graphs[i];

        ensureSpace(90);

        // Section heading
        pdf.setFontSize(14);
        pdf.setTextColor(30);
        pdf.setFont("helvetica", "bold");
        const graphTitle = graph?.title || `Chart ${i + 1}`;
        const chartTypeLabel = graph?.chartType ? ` (${graph.chartType})` : "";
        pdf.text(graphTitle + chartTypeLabel, margin, y);
        y += 2;

        // Thin separator
        pdf.setDrawColor(200);
        pdf.setLineWidth(0.3);
        pdf.line(margin, y, margin + 60, y);
        y += 5;

        // Render chart to canvas with white background
        try {
          const canvas = await html2canvas(el, {
            backgroundColor: "#ffffff",
            scale: 3,
            useCORS: true,
            ignoreElements: (element) => {
              // Skip AI chat sections and column picker
              return element.hasAttribute("data-no-export");
            },
          });

          const imgData = canvas.toDataURL("image/png");
          const imgW = cw;
          const imgH = (canvas.height / canvas.width) * imgW;
          const finalH = Math.min(imgH, 100);

          ensureSpace(finalH + 10);

          // Light gray border around chart image
          pdf.setDrawColor(220);
          pdf.setLineWidth(0.3);
          pdf.roundedRect(margin - 1, y - 1, cw + 2, finalH + 2, 2, 2, "S");

          pdf.addImage(imgData, "PNG", margin, y, imgW, finalH);
          y += finalH + 12;
        } catch (err) {
          pdf.setFontSize(9);
          pdf.setTextColor(180);
          pdf.text("(Chart could not be rendered)", margin, y);
          y += 8;
        }
      }

      // ── NOTES SECTION ──
      if (notes && notes.trim()) {
        ensureSpace(30);

        pdf.setFontSize(14);
        pdf.setTextColor(30);
        pdf.setFont("helvetica", "bold");
        pdf.text("Important Notes", margin, y);
        y += 2;

        pdf.setDrawColor(200);
        pdf.setLineWidth(0.3);
        pdf.line(margin, y, margin + 60, y);
        y += 6;

        pdf.setFontSize(10);
        pdf.setTextColor(50);
        pdf.setFont("helvetica", "normal");
        const noteLines = pdf.splitTextToSize(notes, cw - 4);
        const noteBlockH = noteLines.length * 5 + 10;

        ensureSpace(noteBlockH + 4);

        // Light background for notes
        pdf.setFillColor(248, 248, 252);
        pdf.setDrawColor(220);
        pdf.roundedRect(margin, y, cw, noteBlockH, 2, 2, "FD");

        pdf.text(noteLines, margin + 4, y + 7);
        y += noteBlockH + 10;
      }

      // ── ADD FOOTERS ──
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        addFooter(p, totalPages);
      }

      pdf.save(`${tabName.replace(/\s+/g, "_")}_report.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  async function exportPNG() {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(contentRef.current, {
        backgroundColor: "#0f0f14",
        scale: 2,
        useCORS: true,
        scrollY: -window.scrollY,
        height: contentRef.current.scrollHeight,
        windowHeight: contentRef.current.scrollHeight,
      });
      const link = document.createElement("a");
      link.download = `${tabName.replace(/\s+/g, "_")}_report.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("PNG export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={exportPDF}
        disabled={exporting}
        className="rounded-lg border border-ink-600 px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition hover:border-accent hover:text-accent disabled:opacity-40"
      >
        {exporting ? "Exporting…" : "Export PDF"}
      </button>
      <button
        onClick={exportPNG}
        disabled={exporting}
        className="rounded-lg border border-ink-600 px-3 py-1.5 text-[11px] font-medium text-zinc-400 transition hover:border-accent hover:text-accent disabled:opacity-40"
      >
        PNG
      </button>
    </div>
  );
}
