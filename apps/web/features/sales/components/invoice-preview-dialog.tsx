"use client";

import { Download, Printer, X } from "lucide-react";
import type { DocumentPreview } from "../domain/document-preview";

/**
 * Prints what the record actually holds. Nothing on this sheet is illustrative:
 * an empty document shows as empty rather than as an example invoice.
 */
export function InvoicePreviewDialog({
  open,
  document,
  onClose,
}: {
  open: boolean;
  document: DocumentPreview;
  onClose: () => void;
}) {
  if (!open) return null;
  const { currency } = document;

  const downloadPdf = async () => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.setFillColor(0, 125, 204);
    pdf.rect(0, 0, 210, 28, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(18);
    pdf.text("BLUE PLASTIC CENTER", 16, 18);
    pdf.setTextColor(25, 49, 63);
    pdf.setFontSize(20);
    pdf.text(document.documentTitle.toUpperCase(), 194, 44, { align: "right" });
    pdf.setFontSize(10);
    pdf.text(document.documentNumber, 194, 52, { align: "right" });
    if (document.date) pdf.text(`Date: ${document.date}`, 194, 58, { align: "right" });
    if (document.dueDate)
      pdf.text(`Due: ${document.dueDate}`, 194, 64, { align: "right" });
    pdf.setFontSize(9);
    pdf.text(document.partyLabel.toUpperCase(), 16, 44);
    pdf.setFontSize(13);
    pdf.text(document.partyName, 16, 52);
    pdf.setDrawColor(220, 230, 237);
    pdf.line(16, 74, 194, 74);
    pdf.setFillColor(245, 249, 252);
    pdf.rect(16, 80, 178, 10, "F");
    pdf.setFontSize(9);
    pdf.text("DESCRIPTION", 20, 87);
    pdf.text("QTY", 120, 87);
    pdf.text("RATE", 145, 87);
    pdf.text("AMOUNT", 190, 87, { align: "right" });
    pdf.setFontSize(10);
    let cursor = 98;
    for (const line of document.lines) {
      pdf.text(line.description.slice(0, 60), 20, cursor);
      pdf.text(line.quantity, 120, cursor);
      pdf.text(line.rate, 145, cursor);
      pdf.text(line.amount, 190, cursor, { align: "right" });
      cursor += 8;
    }
    cursor += 4;
    pdf.line(120, cursor, 194, cursor);
    cursor += 8;
    for (const total of document.totals) {
      pdf.setFontSize(total.strong ? 12 : 10);
      pdf.text(total.label, 145, cursor);
      pdf.text(`${currency} ${total.value}`, 190, cursor, { align: "right" });
      cursor += total.strong ? 9 : 7;
    }
    pdf.save(`${document.documentNumber}.pdf`);
  };

  return (
    <div
      onMouseDown={onClose}
      className="fixed inset-0 z-[70] grid place-items-center bg-[#061625]/60 p-3 backdrop-blur-sm"
    >
      <div
        onMouseDown={(event) => event.stopPropagation()}
        className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#eef2f5] shadow-2xl"
      >
        <div className="flex items-center gap-2 border-b border-[#d9e3e9] bg-white px-4 py-3">
          <div>
            <h2 className="text-sm font-bold">Document preview</h2>
            <p className="text-[10px] text-[#82949e]">
              {document.documentNumber}
            </p>
          </div>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => window.print()}
              className="flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold"
            >
              <Printer size={14} /> Print
            </button>
            <button
              onClick={() => void downloadPdf()}
              className="flex h-9 items-center gap-2 rounded-lg bg-[#007DCC] px-3 text-xs font-bold text-white"
            >
              <Download size={14} /> Download PDF
            </button>
            <button
              aria-label="Close preview"
              onClick={onClose}
              className="grid size-9 place-items-center rounded-lg border"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-4 md:p-8">
          <article className="mx-auto min-h-[820px] max-w-[720px] bg-white p-8 shadow-lg md:p-12">
            <div className="flex justify-between border-b-4 border-[#007DCC] pb-7">
              <p className="text-lg font-black text-[#007DCC]">
                BLUE PLASTIC CENTER
              </p>
              <div className="text-right">
                <p className="text-3xl font-light uppercase tracking-wide text-[#334c59]">
                  {document.documentTitle}
                </p>
                <p className="mt-3 text-xs font-bold">
                  {document.documentNumber}
                </p>
                {document.date ? (
                  <p className="mt-1 text-xs text-[#687d88]">
                    {document.date}
                    {document.dueDate ? ` · Due ${document.dueDate}` : ""}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-8">
              <div>
                <p className="text-[10px] font-bold uppercase text-[#82949e]">
                  {document.partyLabel}
                </p>
                <p className="mt-2 text-sm font-bold">{document.partyName}</p>
              </div>
              {document.reference ? (
                <div className="text-right">
                  <p className="text-[10px] uppercase text-[#82949e]">
                    Reference
                  </p>
                  <p className="mt-1 text-xs font-bold">{document.reference}</p>
                </div>
              ) : null}
            </div>
            <table className="mt-10 w-full text-left text-xs">
              <thead className="bg-[#eef7fd] text-[10px] uppercase text-[#456171]">
                <tr>
                  <th className="p-3">Description</th>
                  <th className="p-3 text-right">Qty</th>
                  <th className="p-3 text-right">Rate</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {document.lines.map((line, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-3 font-semibold">{line.description}</td>
                    <td className="p-3 text-right">{line.quantity}</td>
                    <td className="p-3 text-right tabular-nums">{line.rate}</td>
                    <td className="p-3 text-right font-bold tabular-nums">
                      {line.amount}
                    </td>
                  </tr>
                ))}
                {!document.lines.length ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="p-6 text-center text-[#82949e]"
                    >
                      This document has no lines.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
            <div className="ml-auto mt-8 w-64 space-y-3 text-xs">
              {document.totals.map((total) => (
                <div
                  key={total.label}
                  className={
                    total.strong
                      ? "flex justify-between border-t-2 border-[#1c3948] pt-3 text-base font-bold"
                      : "flex justify-between"
                  }
                >
                  <span>{total.label}</span>
                  <span className="tabular-nums">
                    {currency} {total.value}
                  </span>
                </div>
              ))}
            </div>
            {document.memo ? (
              <div className="mt-16 rounded-xl bg-[#f7fafc] p-4 text-xs leading-5 text-[#607681]">
                {document.memo}
              </div>
            ) : null}
          </article>
        </div>
      </div>
    </div>
  );
}
