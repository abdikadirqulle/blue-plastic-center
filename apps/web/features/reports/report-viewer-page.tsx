import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { format, startOfMonth } from "date-fns";
import { ArrowLeft, Download, Printer, RefreshCw } from "lucide-react";
import { Link } from "@/components/routing";
import { AppShell } from "../../components/layout/app-shell";
import { Card } from "../../components/ui/card";
import { DatePicker } from "../../components/ui/date-picker";
import { DataTableSkeleton } from "../../components/ui/skeleton";
import { Select } from "../../components/ui/select";
import { apiClient } from "../../lib/api-client";

interface ReportResult {
  reportId: string;
  kind: string;
  generatedAt: string;
  rows: Array<Record<string, unknown>>;
  controlTotals?: { debit: string; credit: string; balanced: boolean };
}

const labels: Record<string, string> = {
  accountId: "Account",
  accountNumber: "Account no.",
  accountName: "Account name",
  accountType: "Type",
  debit: "Debit",
  credit: "Credit",
  balance: "Balance",
  customer: "Customer",
  vendor: "Vendor",
  dueDate: "Due date",
  agingBucket: "Aging",
  inventoryValue: "Value",
};

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function csvCell(value: unknown) {
  return `"${display(value).replaceAll('"', '""')}"`;
}

export function ReportViewerPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const name = searchParams.get("name") ?? "Financial report";
  const kind = searchParams.get("kind") ?? "trial-balance";
  const [from, setFrom] = useState(searchParams.get("from") ?? format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(searchParams.get("to") ?? format(new Date(), "yyyy-MM-dd"));
  const [basis, setBasis] = useState(searchParams.get("basis") ?? "accrual");
  const [parameters, setParameters] = useState({ from, to, basis });
  const [result, setResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void apiClient.action<ReportResult>(`/v1/reports/${kind}/run`, { ...parameters, currency: "USD" })
      .then((response) => { if (active) setResult(response.data); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Unable to run this report."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [kind, parameters]);

  const columns = useMemo(() => {
    const keys = new Set<string>();
    result?.rows.forEach((row) => Object.keys(row).forEach((key) => {
      if (!["companyId", "branchId", "isDeleted", "deletedAt"].includes(key)) keys.add(key);
    }));
    return [...keys].slice(0, 9);
  }, [result]);

  const updateParameters = () => {
    setSearchParams({ name, kind, from, to, basis });
    setParameters({ from, to, basis });
  };

  const exportCsv = () => {
    if (!result) return;
    const csv = [columns.map((column) => csvCell(labels[column] ?? column)).join(","), ...result.rows.map((row) => columns.map((column) => csvCell(row[column])).join(","))].join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link href="/reports/financial" className="inline-flex items-center gap-2 text-xs font-medium text-[#526a76]"><ArrowLeft size={15}/> All reports</Link>
          <div className="flex items-center gap-2">
            <button onClick={exportCsv} disabled={!result || loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d9e3e9] bg-white px-3 text-xs font-medium disabled:opacity-40"><Download size={14}/> Export</button>
            <button onClick={() => window.print()} disabled={!result || loading} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d9e3e9] bg-white px-3 text-xs font-medium disabled:opacity-40"><Printer size={14}/> Print</button>
          </div>
        </div>

        <Card className="overflow-hidden rounded-xl">
          <div className="border-b border-[#e4eaee] px-6 py-5 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#71838d]">BLUE PLASTIC CENTER</p>
            <h1 className="mt-1 text-xl font-semibold text-[#18313e]">{name}</h1>
            <p className="mt-1 text-xs text-[#71838d]">{parameters.from} through {parameters.to} · {parameters.basis === "cash" ? "Cash" : "Accrual"} basis</p>
          </div>

          <div className="flex flex-wrap items-end gap-2 border-b border-[#e4eaee] bg-[#f8fafb] p-3 print:hidden">
            <label className="w-40 text-[11px] text-[#607681]"><span className="mb-1 block">From</span><DatePicker value={from} onChange={setFrom} className="h-9"/></label>
            <label className="w-40 text-[11px] text-[#607681]"><span className="mb-1 block">To</span><DatePicker value={to} onChange={setTo} className="h-9"/></label>
            <label className="w-32 text-[11px] text-[#607681]"><span className="mb-1 block">Accounting method</span><Select value={basis} onValueChange={setBasis} options={[{label:"Accrual",value:"accrual"},{label:"Cash",value:"cash"}]} className="h-9"/></label>
            <button onClick={updateParameters} disabled={loading} className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#007DCC] px-4 text-xs font-medium text-white disabled:opacity-60"><RefreshCw size={14} className={loading ? "animate-spin" : ""}/> Run report</button>
          </div>

          {loading ? <DataTableSkeleton columns={columns.length ? columns.map((column) => labels[column] ?? column.replace(/([A-Z])/g, " $1")) : ["Account", "Description", "Amount"]}/> : error ? <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b-2 border-[#7d8e97] bg-[#f7f9fa]"><tr>{columns.map((column) => <th key={column} className="px-4 py-2.5 font-semibold text-[#405762]">{labels[column] ?? column.replace(/([A-Z])/g, " $1")}</th>)}</tr></thead>
                <tbody>{result?.rows.length ? result.rows.map((row, index) => <tr key={String(row.id ?? index)} className="border-b border-[#e8edef]">{columns.map((column) => <td key={column} className={`px-4 py-2.5 text-[#344d59] ${/debit|credit|amount|balance|value|total/i.test(column) ? "text-right tabular-nums" : ""}`}>{display(row[column])}</td>)}</tr>) : <tr><td colSpan={Math.max(columns.length, 1)} className="px-6 py-16 text-center text-[#71838d]">No transactions found for this report period.</td></tr>}</tbody>
                {result?.controlTotals ? <tfoot className="border-t-2 border-[#7d8e97] bg-[#f7f9fa]"><tr><td colSpan={Math.max(columns.length - 2, 1)} className="px-4 py-3 font-semibold">TOTAL</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{result.controlTotals.debit}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{result.controlTotals.credit}</td></tr></tfoot> : null}
              </table>
            </div>
          )}
          <div className="flex justify-between border-t border-[#e4eaee] px-5 py-3 text-[10px] text-[#80919a]"><span>{result?.rows.length ?? 0} rows</span><span>{result ? `Generated ${new Date(result.generatedAt).toLocaleString()}` : ""}</span></div>
        </Card>
      </div>
    </AppShell>
  );
}
