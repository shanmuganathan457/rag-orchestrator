"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type Props = {
  targetRef: React.RefObject<HTMLDivElement | null>;
  tabName: string;
  chartRef?: React.RefObject<HTMLDivElement | null>;
  data?: Record<string, string | number>[];
  columns?: string[];
  notes?: string;
  datasetNames?: string[];
};

export default function ExportToolbar({ targetRef, tabName, chartRef, data, columns, notes, datasetNames }: Props) {
  const [exporting, setExporting] = useState(false);

  async function exportProfessionalPDF() {
    setExporting(true);
    try {
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth();
      const ph = pdf.internal.pageSize.getHeight();
      const margin = 18;
      const cw = pw - margin * 2;
      let y = margin;

      // ── Helper functions ──
      const addPageIfNeeded = (need: number) => {
        if (y + need > ph - 20) {
          addFooter();
          pdf.addPage();
          y = margin;
        }
      };

      const addFooter = () => {
        pdf.setFontSize(8);
        pdf.setTextColor(150);
        const pg = pdf.getNumberOfPages();
        pdf.text(`Page ${pg}`, pw / 2, ph - 8, { align: "center" });
        pdf.text("RAG Orchestrator · Data Studio Report", margin, ph - 8);
        pdf.text(new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" }), pw - margin, ph - 8, { align: "right" });
      };

      // ── Title Block ──
      pdf.setFillColor(20, 20, 30);
      pdf.rect(0, 0, pw, 55, "F");
      pdf.setFontSize(22);
      pdf.setTextColor(255);
      pdf.setFont("helvetica", "bold");
      pdf.text(tabName || "Data Analysis Report", margin, 25);
      pdf.setFontSize(10);
      pdf.setTextColor(180);
      pdf.setFont("helvetica", "normal");
      const dateStr = new Date().toLocaleString("en-IN", {
        year: "numeric", month: "long", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
      pdf.text(`Generated: ${dateStr}`, margin, 35);
      if (datasetNames && datasetNames.length > 0) {
        pdf.text(`Datasets: ${datasetNames.join(", ")}`, margin, 42);
      }
      pdf.setDrawColor(124, 156, 255);
      pdf.setLineWidth(0.8);
      pdf.line(margin, 50, pw - margin, 50);
      y = 62;

      // ── Chart Image ──
      const chartEl = chartRef?.current || targetRef.current?.querySelector("[data-chart]") as HTMLElement;
      if (chartEl) {
        addPageIfNeeded(100);
        pdf.setFontSize(13);
        pdf.setTextColor(40);
        pdf.setFont("helvetica", "bold");
        pdf.text("Chart", margin, y);
        y += 6;

        const canvas = await html2canvas(chartEl, {
          backgroundColor: "#ffffff",
          scale: 3,
          useCORS: true,
        });
        const imgData = canvas.toDataURL("image/png");
        const imgW = cw;
        const imgH = (canvas.height / canvas.width) * imgW;
        const finalH = Math.min(imgH, 110);

        // White background card with border
        pdf.setFillColor(252, 252, 255);
        pdf.setDrawColor(220);
        pdf.roundedRect(margin - 2, y - 2, cw + 4, finalH + 4, 3, 3, "FD");
        pdf.addImage(imgData, "PNG", margin, y, imgW, finalH);
        y += finalH + 12;
      }

      // ── Data Table ──
      if (data && columns && data.length > 0) {
        addPageIfNeeded(40);
        pdf.setFontSize(13);
        pdf.setTextColor(40);
        pdf.setFont("helvetica", "bold");
        pdf.text("Data Table", margin, y);
        y += 6;

        pdf.setFontSize(8);
        pdf.setTextColor(100);
        pdf.text(`${data.length} rows · ${columns.length} columns`, margin, y);
        y += 5;

        const maxCols = Math.min(columns.length, 8);
        const colW = cw / maxCols;
        const rowH = 6;
        const displayCols = columns.slice(0, maxCols);

        // Table header
        pdf.setFillColor(35, 35, 50);
        pdf.rect(margin, y, cw, rowH + 1, "F");
        pdf.setFontSize(7);
        pdf.setTextColor(255);
        pdf.setFont("helvetica", "bold");
        displayCols.forEach((col, i) => {
          pdf.text(col.substring(0, 18), margin + i * colW + 2, y + 4.5);
        });
        y += rowH + 1;

        // Table rows (max 40 rows)
        const maxRows = Math.min(data.length, 40);
        pdf.setFont("helvetica", "normal");
        for (let r = 0; r < maxRows; r++) {
          addPageIfNeeded(rowH + 2);
          const bg = r % 2 === 0 ? 248 : 240;
          pdf.setFillColor(bg, bg, bg + 4);
          pdf.rect(margin, y, cw, rowH, "F");
          pdf.setTextColor(60);
          pdf.setFontSize(7);
          displayCols.forEach((col, i) => {
            const val = String(data[r][col] ?? "");
            pdf.text(val.substring(0, 20), margin + i * colW + 2, y + 4);
          });
          y += rowH;
        }

        if (data.length > maxRows) {
          y += 3;
          pdf.setFontSize(7);
          pdf.setTextColor(140);
          pdf.text(`... and ${data.length - maxRows} more rows`, margin, y);
          y += 6;
        } else {
          y += 6;
        }
      }

      // ── Notes ──
      if (notes && notes.trim()) {
        addPageIfNeeded(30);
        pdf.setFontSize(13);
        pdf.setTextColor(40);
        pdf.setFont("helvetica", "bold");
        pdf.text("Notes", margin, y);
        y += 6;

        pdf.setFillColor(250, 250, 255);
        pdf.setDrawColor(200);
        const noteLines = pdf.splitTextToSize(notes, cw - 8);
        const noteH = noteLines.length * 4.5 + 8;
        addPageIfNeeded(noteH + 4);
        pdf.roundedRect(margin, y, cw, noteH, 2, 2, "FD");
        pdf.setFontSize(9);
        pdf.setTextColor(50);
        pdf.setFont("helvetica", "normal");
        pdf.text(noteLines, margin + 4, y + 6);
        y += noteH + 8;
      }

      // Add footer to all pages
      const totalPages = pdf.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        addFooter();
      }

      pdf.save(`${tabName.replace(/\s+/g, "_")}_report.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  }

  async function exportPNG() {
    if (!targetRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#0f0f14",
        scale: 2,
        useCORS: true,
        scrollY: -window.scrollY,
        height: targetRef.current.scrollHeight,
        windowHeight: targetRef.current.scrollHeight,
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
        onClick={exportProfessionalPDF}
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
