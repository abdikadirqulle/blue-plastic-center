"use client";

import { Link } from "@/components/routing";
import { useMemo, useState } from "react";
import { useRouter } from "@/components/routing";
import {
  ArrowDownToLine, ArrowRight, Banknote, CalendarDays, ChevronRight,
  CircleDollarSign, FileClock, FileText, Mail, MoreHorizontal,
  Plus, Receipt, RefreshCcw, Send, ShoppingBag, Trash2, Users,
} from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { ConfirmDeleteDialog } from "../../../components/ui/confirm-delete-dialog";
import { DatePicker } from "../../../components/ui/date-picker";
import { Select } from "../../../components/ui/select";
import { TableToolbar } from "../../../components/ui/table-toolbar";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import type { ResourceConfig } from "../../resources/resource-config";
import type { SalesRecord, SalesResource } from "../domain/sales-record";
import { useSalesRecords } from "../hooks/use-sales-records";

const salesTabs = [
  ["invoices", "Invoices"], ["sales-receipts", "Sales receipts"], ["customers", "Customers"],
  ["estimates", "Estimates"], ["sales-orders", "Sales orders"], ["payments", "Payments"],
  ["credit-notes", "Credit memos"], ["refund-receipts", "Refunds"], ["statements", "Statements"],
  ["deposits", "Deposits"], ["recurring-invoices", "Recurring"],
];

const icons: Record<string, typeof FileText> = {
  invoices: FileText, "sales-receipts": Receipt, customers: Users, estimates: FileClock,
  "sales-orders": ShoppingBag, payments: Banknote, "credit-notes": RefreshCcw,
  "refund-receipts": ArrowDownToLine, statements: Mail, deposits: CircleDollarSign,
  "recurring-invoices": CalendarDays,
};

const variants = (status: string) => {
  if (/paid|active|accepted|deposited|cleared|sent|reconciled|converted|applied/i.test(status)) return "success";
  if (/overdue|expired|void|hold|inactive/i.test(status)) return "danger";
  if (/pending|open|undeposited|backorder|partial/i.test(status)) return "warning";
  return "neutral";
};

export function SalesWorkspacePage({ config }: { config: ResourceConfig }) {
  const router = useRouter();
  const resource = config.slug as SalesResource;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SalesRecord | null>(null);
  const [menuRow, setMenuRow] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const query = useMemo(() => ({ search, status, from, to }), [search, status, from, to]);
  const { records, loading, error, remove } = useSalesRecords(resource, query);
  const Icon = icons[resource] ?? FileText;
  const statuses = ["All statuses", ...Array.from(new Set(records.map((record) => record.status)))];
  const isCustomerCenter = resource === "customers";
  const isDepositCenter = resource === "deposits";
  const isStatementCenter = resource === "statements";
  const selectedCustomer = isCustomerCenter ? records[0] : null;
  const statusCount = (pattern: RegExp) =>
    records.filter((record) => pattern.test(record.status)).length;
  const totalAmount = records.reduce((total, record) => {
    const numeric = Number(record.amount.replace(/[^0-9.-]/g, ""));
    return total + (Number.isFinite(numeric) ? numeric : 0);
  }, 0);
  const liveStats = [
    { label: `Total ${config.title.toLowerCase()}`, value: records.length.toLocaleString(), helper: "Live database records" },
    { label: "Open / active", value: statusCount(/open|active|sent|pending|overdue/i).toLocaleString(), helper: "Requires attention" },
    { label: "Completed", value: statusCount(/paid|closed|accepted|deposited|cleared|applied/i).toLocaleString(), helper: "Completed records" },
    { label: "Total value", value: `$${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, helper: "Current filtered result" },
  ];

  const notify = (title: string, description: string) => {
    setToast({ title, description, variant: "success" });
    window.setTimeout(() => setToast(null), 3000);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px]">
        <section className="overflow-hidden rounded-2xl bg-[#09263b] text-white shadow-sm">
          <div className="grid gap-6 px-5 py-6 lg:grid-cols-[1fr_auto] lg:px-7">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#007DCC] shadow-lg shadow-black/20"><Icon size={23}/></span>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-sky-300">Sales center · {config.title}</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] md:text-[30px]">{config.title}</h1><p className="mt-1 max-w-2xl text-xs leading-5 text-[#b6c7d3]">{config.description}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <Link href={`/sales/${resource}/new`} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold"><Plus size={16}/>{config.primaryAction}</Link>
            </div>
          </div>
          <nav className="flex overflow-x-auto border-t border-white/10 bg-black/10 px-3">
            {salesTabs.map(([slug, label]) => <Link key={slug} href={`/sales/${slug}`} className={`shrink-0 border-b-2 px-3 py-3 text-[11px] font-semibold ${slug === resource ? "border-sky-400 text-white" : "border-transparent text-[#9fb4c3] hover:text-white"}`}>{label}</Link>)}
          </nav>
        </section>

        <section className={`mt-4 grid gap-3 ${isCustomerCenter ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
          {liveStats.map((stat, index) => <Card key={stat.label} className="relative overflow-hidden p-4">
            <div className={`absolute inset-y-0 left-0 w-1 ${["bg-[#007DCC]","bg-emerald-500","bg-amber-500","bg-violet-500"][index]}`}/>
            <p className="text-[10px] font-bold uppercase tracking-wide text-[#788b96]">{stat.label}</p><p className="mt-2 text-xl font-bold tracking-[-0.03em] text-[#1f3947]">{stat.value}</p><p className="mt-1 text-[10px] text-[#007DCC]">{stat.helper}</p>
          </Card>)}
        </section>

        {resource === "invoices" ? <div className="mt-4 grid gap-3 md:grid-cols-4">
          {[["Draft",/draft/i,"Prepare & review"],["Sent",/sent/i,"Awaiting payment"],["Overdue",/overdue/i,"Collection required"],["Paid",/paid/i,"Closed invoices"]].map(([label,pattern,helper], index) => <Card key={String(label)} className="flex items-center gap-3 p-4"><span className={`grid size-9 place-items-center rounded-full text-xs font-bold ${index === 2 ? "bg-red-50 text-red-600" : "bg-sky-50 text-[#007DCC]"}`}>{statusCount(pattern as RegExp)}</span><div><p className="text-xs font-bold">{String(label)}</p><p className="mt-0.5 text-[10px] text-[#82949e]">{String(helper)}</p></div><ArrowRight size={14} className="ml-auto text-[#9aa8b0]"/></Card>)}
        </div> : null}

        <Card className="mt-4 overflow-hidden">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={config.searchPlaceholder}
            filterTitle={`Filter ${config.title}`}
            filterDescription={`Filter ${config.title.toLowerCase()} using sales-specific status and date fields.`}
            activeFilterCount={[status !== "All statuses", Boolean(from), Boolean(to)].filter(Boolean).length}
            onResetFilters={() => { setStatus("All statuses"); setFrom(""); setTo(""); }}
            columns={["Document", "Customer", "Amount", "Date", "Status"]}
            rows={records.map((record) => [record.displayId, record.customer, record.amount, record.date, record.status])}
            fileName={`blue-plastic-sales-${resource}`}
            filterContent={<>
              <label className="text-xs font-semibold text-[#405762] sm:col-span-2"><span className="mb-1.5 block">Sales status</span><Select value={status} onValueChange={setStatus} options={statuses.length ? statuses : ["All statuses"]}/></label>
              <label className="text-xs font-semibold text-[#405762]"><span className="mb-1.5 block">From date</span><DatePicker value={from} onChange={setFrom}/></label>
              <label className="text-xs font-semibold text-[#405762]"><span className="mb-1.5 block">To date</span><DatePicker value={to} onChange={setTo}/></label>
            </>}
          />

          {error ? <div className="p-8 text-center text-sm font-semibold text-red-600">{error}</div> : loading ? <div className="p-12 text-center text-sm font-semibold text-[#71848f]">Loading {config.title.toLowerCase()}…</div> :
          isCustomerCenter ? (
            <div className="grid gap-0 md:grid-cols-[320px_1fr]">
              <div className="border-r border-[#e4ebf0] bg-[#f8fafc] p-3">{records.map((record, index) => <button key={record.id} onClick={() => router.push(`/sales/customers/${record.id}`)} className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${index === 0 ? "border-[#007DCC] bg-white shadow-sm" : "border-transparent hover:bg-white"}`}><span className="grid size-9 place-items-center rounded-full bg-[#e6f4fc] text-[10px] font-bold text-[#007DCC]">{record.customer.split(" ").map((word) => word[0]).slice(0,2)}</span><span className="min-w-0"><strong className="block truncate text-xs text-[#2c4552]">{record.customer}</strong><span className="text-[10px] text-[#82949e]">{record.displayId} · {record.status}</span></span><ChevronRight size={14} className="ml-auto"/></button>)}</div>
              <div className="p-5">
                {selectedCustomer ? <><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase text-[#82949e]">Selected customer</p><h2 className="mt-1 text-xl font-bold">{selectedCustomer.customer}</h2><p className="mt-1 text-xs text-[#71848f]">{selectedCustomer.reference || selectedCustomer.id} · {selectedCustomer.status}</p></div><Link href={`/sales/customers/${selectedCustomer.id}`} className="rounded-xl bg-[#007DCC] px-3 py-2 text-xs font-bold text-white">Open customer</Link></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{[["Balance",selectedCustomer.balance ?? selectedCustomer.amount],["Status",selectedCustomer.status],["Created",selectedCustomer.date]].map(([label,value]) => <div key={label} className="rounded-xl bg-[#f6f9fb] p-4"><p className="text-[10px] text-[#82949e]">{label}</p><p className="mt-1 text-sm font-bold">{value || "—"}</p></div>)}</div></> : <div className="grid min-h-56 place-items-center text-center"><div><Users className="mx-auto text-[#9bb0bb]"/><h2 className="mt-3 text-sm font-bold">No customers yet</h2><p className="mt-1 text-xs text-[#71848f]">Add your first customer to start recording sales.</p><Link href="/sales/customers/new" className="mt-4 inline-flex rounded-xl bg-[#007DCC] px-4 py-2.5 text-xs font-bold text-white">Add customer</Link></div></div>}
              </div>
            </div>
          ) : isStatementCenter ? (
            <div className="grid gap-3 p-4 lg:grid-cols-2">{records.map((record) => <article key={record.id} className="rounded-2xl border border-[#e2eaf0] p-4 hover:border-[#9dcdeb]"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold text-[#007DCC]">{record.displayId}</p><h3 className="mt-1 text-sm font-bold">{record.customer}</h3></div><Badge variant={variants(record.status)}>{record.status}</Badge></div><div className="mt-4 flex items-end justify-between"><div><p className="text-[10px] text-[#82949e]">Statement balance</p><p className="mt-1 text-lg font-bold">{record.amount}</p></div><div className="flex gap-2"><button onClick={() => notify("Statement emailed", `${record.displayId} was sent to ${record.customer}.`)} className="rounded-lg border p-2 text-[#007DCC]"><Send size={15}/></button><Link href={`/sales/statements/${record.id}`} className="rounded-lg bg-[#eef7fd] px-3 py-2 text-[11px] font-bold text-[#007DCC]">Preview</Link></div></div></article>)}</div>
          ) : (
            <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-[#f8fafc]"><tr>{config.columns.map((column) => <th key={column} className="border-b border-[#e5ecf1] px-5 py-3 text-[9px] font-bold uppercase tracking-wide text-[#788b96]">{column}</th>)}<th className="border-b border-[#e5ecf1] px-5 py-3 text-[9px] font-bold uppercase text-[#788b96]">Status</th><th className="border-b border-[#e5ecf1] px-5 py-3 text-right text-[9px] font-bold uppercase text-[#788b96]">Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} onClick={() => router.push(`/sales/${resource}/${encodeURIComponent(record.id)}`)} className="cursor-pointer border-b border-[#edf1f4] hover:bg-[#f2f9fd]"><td className="px-5 py-4 text-xs font-bold text-[#007DCC]">{record.displayId}</td><td className="px-5 py-4"><p className="text-xs font-bold text-[#304954]">{isDepositCenter ? record.paymentMethod ?? record.customer : record.customer}</p><p className="mt-1 text-[10px] text-[#82949e]">{record.reference}</p></td><td className="px-5 py-4 text-xs font-bold">{record.amount}</td>{config.columns.slice(3).map((column, index) => <td key={column} className="px-5 py-4 text-xs text-[#526874]">{index === 0 && record.paymentMethod ? record.paymentMethod : record.date}</td>)}<td className="px-5 py-4"><Badge variant={variants(record.status)}>{record.status}</Badge></td><td onClick={(event) => event.stopPropagation()} className="relative px-5 py-4 text-right"><button aria-label={`Delete ${record.displayId}`} onClick={() => setDeleteTarget(record)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={15}/></button><button aria-label={`More actions for ${record.displayId}`} onClick={() => setMenuRow((current) => current === record.id ? null : record.id)} className="rounded-lg p-2 text-[#758995] hover:bg-[#eef7fd]"><MoreHorizontal size={16}/></button>{menuRow === record.id ? <div className="absolute right-4 top-12 z-30 w-40 rounded-xl border border-[#dce6ed] bg-white p-1.5 text-left shadow-xl"><Link href={`/sales/${resource}/${encodeURIComponent(record.id)}`} onClick={() => setMenuRow(null)} className="block rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[#eef7fd]">View details</Link><Link href={`/sales/${resource}/new?edit=${encodeURIComponent(record.id)}`} onClick={() => setMenuRow(null)} className="block rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[#eef7fd]">Edit</Link><button onClick={() => { setDeleteTarget(record); setMenuRow(null); }} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50">Delete</button></div> : null}</td></tr>)}</tbody></table>{!records.length ? <div className="p-16 text-center text-sm font-semibold text-[#71848f]">No matching {config.title.toLowerCase()} found.</div> : null}</div>
          )}
        </Card>
      </div>
      <Toast message={toast} onClose={() => setToast(null)}/>
      <ConfirmDeleteDialog open={Boolean(deleteTarget)} title={`Move ${deleteTarget?.id} to Trash?`} recordName={deleteTarget ? `${deleteTarget.id} · ${deleteTarget.customer}` : undefined} description="The record will be hidden from Sales and can be restored from Trash." onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) void remove(deleteTarget.id); setDeleteTarget(null); notify("Moved to Trash", "The sales workspace has been updated."); }}/>
    </AppShell>
  );
}
