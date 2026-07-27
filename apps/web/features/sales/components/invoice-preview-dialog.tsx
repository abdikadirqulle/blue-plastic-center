"use client";

import { Download, Mail, Printer, X } from "lucide-react";
import type { ResourceRow } from "../../resources/resource-config";

export function InvoicePreviewDialog({ open, row, title, onClose, onEmail }: {
  open: boolean;
  row: ResourceRow;
  title: string;
  onClose: () => void;
  onEmail: () => void;
}) {
  if (!open) return null;
  const amount = row.cells[1] ?? "$8,420.00";

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
    pdf.text(title.toUpperCase(), 150, 44, { align: "right" });
    pdf.setFontSize(10);
    pdf.text(`Document: ${row.id}`, 150, 52, { align: "right" });
    pdf.text("BLUE PLASTIC CENTER", 16, 44);
    pdf.text("Maka Al Mukarama Road, Mogadishu", 16, 51);
    pdf.text("finance@blueplastic.example", 16, 58);
    pdf.setDrawColor(220, 230, 237);
    pdf.line(16, 70, 194, 70);
    pdf.setFontSize(11);
    pdf.text("BILL TO", 16, 80);
    pdf.setFontSize(13);
    pdf.text(row.cells[0] ?? "Banaadir Trading Co.", 16, 89);
    pdf.setFillColor(245, 249, 252);
    pdf.rect(16, 105, 178, 12, "F");
    pdf.setFontSize(9);
    pdf.text("DESCRIPTION", 20, 113);
    pdf.text("QTY", 120, 113);
    pdf.text("RATE", 145, 113);
    pdf.text("AMOUNT", 190, 113, { align: "right" });
    pdf.setFontSize(10);
    pdf.text("Products and services", 20, 128);
    pdf.text("1", 122, 128);
    pdf.text(amount, 145, 128);
    pdf.text(amount, 190, 128, { align: "right" });
    pdf.line(120, 145, 194, 145);
    pdf.setFontSize(13);
    pdf.text("TOTAL", 145, 158);
    pdf.text(amount, 190, 158, { align: "right" });
    pdf.setFontSize(9);
    pdf.setTextColor(100, 120, 132);
    pdf.text("Thank you for your business.", 105, 275, { align: "center" });
    pdf.save(`${row.id}.pdf`);
  };

  return (
    <div onMouseDown={onClose} className="fixed inset-0 z-[70] grid place-items-center bg-[#061625]/60 p-3 backdrop-blur-sm">
      <div onMouseDown={(event) => event.stopPropagation()} className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[#eef2f5] shadow-2xl">
        <div className="flex items-center gap-2 border-b border-[#d9e3e9] bg-white px-4 py-3">
          <div><h2 className="text-sm font-bold">Document preview</h2><p className="text-[10px] text-[#82949e]">{row.id} · ready to send</p></div>
          <div className="ml-auto flex gap-2">
            <button onClick={onEmail} className="flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold"><Mail size={14}/> Email</button>
            <button onClick={() => window.print()} className="flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold"><Printer size={14}/> Print</button>
            <button onClick={() => void downloadPdf()} className="flex h-9 items-center gap-2 rounded-lg bg-[#007DCC] px-3 text-xs font-bold text-white"><Download size={14}/> Download PDF</button>
            <button aria-label="Close preview" onClick={onClose} className="grid size-9 place-items-center rounded-lg border"><X size={16}/></button>
          </div>
        </div>
        <div className="overflow-y-auto p-4 md:p-8">
          <article className="mx-auto min-h-[820px] max-w-[720px] bg-white p-8 shadow-lg md:p-12">
            <div className="flex justify-between border-b-4 border-[#007DCC] pb-7"><div><p className="text-lg font-black text-[#007DCC]">BLUE PLASTIC CENTER</p><p className="mt-2 text-xs leading-5 text-[#687d88]">Maka Al Mukarama Road<br/>Mogadishu, Somalia<br/>finance@blueplastic.example</p></div><div className="text-right"><p className="text-3xl font-light uppercase tracking-wide text-[#334c59]">{title.replace(/s$/, "")}</p><p className="mt-3 text-xs font-bold">{row.id}</p><p className="mt-1 text-xs text-[#687d88]">25 Jul 2026 · Due 24 Aug 2026</p></div></div>
            <div className="mt-8 grid grid-cols-2 gap-8"><div><p className="text-[10px] font-bold uppercase text-[#82949e]">Bill to</p><p className="mt-2 text-sm font-bold">{row.cells[0]}</p><p className="mt-1 text-xs leading-5 text-[#687d88]">Maka Al Mukarama Road<br/>Mogadishu, Somalia</p></div><div className="text-right"><p className="text-[10px] uppercase text-[#82949e]">Terms</p><p className="mt-1 text-xs font-bold">Net 30</p><p className="mt-4 text-[10px] uppercase text-[#82949e]">Customer PO</p><p className="mt-1 text-xs font-bold">PO-2401</p></div></div>
            <table className="mt-10 w-full text-left text-xs"><thead className="bg-[#eef7fd] text-[10px] uppercase text-[#456171]"><tr><th className="p-3">Description</th><th className="p-3 text-right">Qty</th><th className="p-3 text-right">Rate</th><th className="p-3 text-right">Amount</th></tr></thead><tbody><tr className="border-b"><td className="p-3"><strong>Plastic products and supplies</strong><p className="mt-1 text-[10px] text-[#82949e]">Primary transaction line</p></td><td className="p-3 text-right">1</td><td className="p-3 text-right">{amount}</td><td className="p-3 text-right font-bold">{amount}</td></tr></tbody></table>
            <div className="ml-auto mt-8 w-64 space-y-3 text-xs"><div className="flex justify-between"><span>Subtotal</span><strong>{amount}</strong></div><div className="flex justify-between"><span>Tax</span><strong>$0.00</strong></div><div className="flex justify-between border-t-2 border-[#1c3948] pt-3 text-base"><strong>Total</strong><strong>{amount}</strong></div><div className="flex justify-between text-[#007DCC]"><span>Balance due</span><strong>{amount}</strong></div></div>
            <div className="mt-16 rounded-xl bg-[#f7fafc] p-4 text-xs text-[#607681]"><strong>Payment instructions</strong><p className="mt-1 leading-5">Please include {row.id} as your payment reference. Bank and mobile-money details are available from our finance team.</p></div>
          </article>
        </div>
      </div>
    </div>
  );
}
