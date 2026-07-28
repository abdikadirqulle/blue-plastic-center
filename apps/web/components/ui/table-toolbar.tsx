"use client";

import { Download, FileSpreadsheet, FileText, Filter, Printer, Search, X } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

interface TableToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  filterTitle: string;
  filterDescription?: string;
  filterContent: ReactNode;
  activeFilterCount?: number;
  onResetFilters: () => void;
  columns: string[];
  rows: string[][];
  fileName: string;
}

function downloadBlob(contents: BlobPart, type: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function TableToolbar({
  search,
  onSearchChange,
  searchPlaceholder,
  filterTitle,
  filterDescription,
  filterContent,
  activeFilterCount = 0,
  onResetFilters,
  columns,
  rows,
  fileName,
}: TableToolbarProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!exportRef.current?.contains(event.target as Node)) setExportOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const exportExcel = () => {
    const escape = (value: string) =>
      value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    const normalizedRows = rows.map((row) => columns.map((_, index) => row[index] ?? ""));
    const table = [columns, ...normalizedRows]
      .map((row, index) => `<tr>${row.map((value) => `<${index ? "td" : "th"}>${escape(value)}</${index ? "td" : "th"}>`).join("")}</tr>`)
      .join("");
    downloadBlob(`\uFEFF<html><body><table>${table}</table></body></html>`, "application/vnd.ms-excel;charset=utf-8", `${fileName}.xls`);
    setExportOpen(false);
  };

  const exportPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });
    pdf.setFontSize(15);
    pdf.text(filterTitle, 14, 16);
    pdf.setFontSize(8);
    const widths = columns.map(() => Math.max(24, (pdf.internal.pageSize.getWidth() - 28) / columns.length));
    let y = 25;
    const drawRow = (row: string[], header = false) => {
      if (y > pdf.internal.pageSize.getHeight() - 14) {
        pdf.addPage();
        y = 16;
      }
      if (header) {
        pdf.setFillColor(234, 245, 252);
        pdf.rect(14, y - 5, widths.reduce((sum, width) => sum + width, 0), 8, "F");
      }
      let x = 14;
      row.forEach((cell, index) => {
        pdf.text(String(cell).slice(0, 34), x + 1, y, { maxWidth: widths[index] - 2 });
        x += widths[index];
      });
      y += 8;
    };
    drawRow(columns, true);
    rows.forEach((row) => drawRow(columns.map((_, index) => row[index] ?? "")));
    pdf.save(`${fileName}.pdf`);
    setExportOpen(false);
  };

  return (
    <>
      <div className="flex flex-col gap-2 border-b border-[#e4ebf0] bg-[#fbfcfd] p-3.5 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82949e]"/>
          <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={searchPlaceholder} className="h-10 w-full rounded-xl border border-[#dce6ed] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"/>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setFilterOpen(true)} className="relative flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3 text-xs font-semibold text-[#425b68] hover:border-[#007DCC] hover:text-[#007DCC]">
            <Filter size={15}/> Filter
            {activeFilterCount ? <span className="grid size-5 place-items-center rounded-full bg-[#007DCC] text-[9px] font-bold text-white">{activeFilterCount}</span> : null}
          </button>
          <div ref={exportRef} className="relative">
            <button type="button" onClick={() => setExportOpen((open) => !open)} className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3 text-xs font-semibold text-[#425b68] hover:border-[#007DCC] hover:text-[#007DCC]"><Download size={15}/> Export</button>
            {exportOpen ? <div className="absolute right-0 top-12 z-40 w-48 rounded-xl border border-[#dce6ed] bg-white p-1.5 shadow-xl">
              <button type="button" onClick={() => void exportPdf()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold hover:bg-[#eef7fd]"><FileText size={15} className="text-red-500"/> Export as PDF</button>
              <button type="button" onClick={exportExcel} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-semibold hover:bg-[#eef7fd]"><FileSpreadsheet size={15} className="text-emerald-600"/> Export as Excel</button>
            </div> : null}
          </div>
          <button type="button" onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3 text-xs font-semibold text-[#425b68] hover:border-[#007DCC] hover:text-[#007DCC]"><Printer size={15}/> Print</button>
        </div>
      </div>

      {filterOpen ? <div onMouseDown={() => setFilterOpen(false)} className="fixed inset-0 z-[120] grid place-items-center bg-[#071f33]/45 p-4 backdrop-blur-sm">
        <section role="dialog" aria-modal="true" aria-label={filterTitle} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#dce6ed] bg-white shadow-[0_24px_80px_rgba(7,31,51,0.28)]">
          <header className="flex items-start justify-between border-b border-[#e5ecf1] px-5 py-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#007DCC]">Table filters</p><h2 className="mt-1 text-lg font-semibold text-[#213946]">{filterTitle}</h2>{filterDescription ? <p className="mt-1 text-xs text-[#748893]">{filterDescription}</p> : null}</div>
            <button type="button" aria-label="Close filters" onClick={() => setFilterOpen(false)} className="rounded-lg p-2 text-[#71848f] hover:bg-[#f1f5f7]"><X size={17}/></button>
          </header>
          <div className="grid gap-4 p-5 sm:grid-cols-2">{filterContent}</div>
          <footer className="flex justify-between border-t border-[#e5ecf1] bg-[#fbfcfd] px-5 py-4">
            <button type="button" onClick={onResetFilters} className="h-10 rounded-xl border border-[#dce6ed] px-4 text-xs font-semibold text-[#526874]">Reset filters</button>
            <button type="button" onClick={() => setFilterOpen(false)} className="h-10 rounded-xl bg-[#007DCC] px-5 text-xs font-semibold text-white">Apply filters</button>
          </footer>
        </section>
      </div> : null}
    </>
  );
}
