"use client";

import { useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

type Props = {
  targetRef: React.RefObject<HTMLDivElement | null>;
  tabName: string;
};

export default function ExportToolbar({ targetRef, tabName }: Props) {
  const [exporting, setExporting] = useState(false);

  async function exportPDF() {
    if (!targetRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: "#0f0f14",
        scale: 2,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${tabName.replace(/\s+/g, "_")}_report.pdf`);
    } catch (err) {
      console.error("Export failed:", err);
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
      });
      const link = document.createElement("a");
      link.download = `${tabName.replace(/\s+/g, "_")}_report.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
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
