"use client";

import { Link } from "@/components/routing";
import { useMemo, useState } from "react";
import { useRouter } from "@/components/routing";
import {
  ArrowRight, Boxes, Check, CheckCircle2, ClipboardCheck,
  Download, Factory, Filter, Landmark, PackageCheck, Plus, Printer,
  Search, ShieldCheck, ShoppingCart, Sparkles, Trash2, Truck,
} from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { ConfirmDeleteDialog } from "../../../components/ui/confirm-delete-dialog";
import { DatePicker } from "../../../components/ui/date-picker";
import { Select } from "../../../components/ui/select";
import { LoadingState } from "../../../components/ui/loading-state";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import type { ResourceConfig } from "../../resources/resource-config";
import type {
  OperationRecord,
  OperationsModule,
  OperationsResource,
} from "../domain/operation-record";
import { useOperationRecords } from "../hooks/use-operation-records";

const moduleMeta = {
  purchasing: { eyebrow: "Procure-to-pay", icon: ShoppingCart, accent: "from-[#0a4a66] to-[#09283c]" },
  inventory: { eyebrow: "Inventory operations", icon: Boxes, accent: "from-[#145448] to-[#092f31]" },
  banking: { eyebrow: "Cash management", icon: Landmark, accent: "from-[#263b6b] to-[#102941]" },
};

const variant = (status: string) => {
  if (/paid|active|approved|posted|received|healthy|released|connected|matched|cleared|ready|allocated|reconciled/i.test(status)) return "success";
  if (/overdue|hold|critical|shortage|backorder|difference|void|cancel|expired/i.test(status)) return "danger";
  if (/pending|open|review|partial|progress|transit|scheduled|reorder|watch|draft/i.test(status)) return "warning";
  return "neutral";
};

const workflowLabels: Partial<Record<OperationsResource, string[]>> = {
  "purchase-orders": ["Purchase order", "Receive items", "Enter bill", "Pay vendor"],
  receipts: ["Purchase order", "Partial receipt", "Quality check", "Create bill"],
  bills: ["Enter bill", "Approve", "Schedule payment", "Clear"],
  fulfillment: ["Allocate", "Pick", "Pack", "Ship"],
  reconciliation: ["Statement", "Clear transactions", "Review difference", "Finish"],
  "bank-feeds": ["Download", "Review", "Match or add", "Post"],
};

export function OperationsWorkspacePage({ config }: { config: ResourceConfig }) {
  const router = useRouter();
  const opsModule = config.module as OperationsModule;
  const resource = config.slug as OperationsResource;
  const meta = moduleMeta[opsModule];
  const Icon = meta.icon;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<OperationRecord | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const query = useMemo(() => ({ search, status, from, to }), [search, status, from, to]);
  const { records, loading, error, remove, updateStatus } = useOperationRecords(opsModule, resource, query);
  const statuses = ["All statuses", ...Array.from(new Set(records.map((record) => record.status)))];
  const workflow = workflowLabels[resource];
  const numericAmount = (record: OperationRecord) => {
    const value = Number(record.amount.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(value) ? value : 0;
  };
  const totalValue = records.reduce((sum, record) => sum + numericAmount(record), 0);
  const activeCount = records.filter((record) => /active|paid|approved|posted|received|cleared|ready|reconciled/i.test(record.status)).length;
  const attentionCount = records.filter((record) => /overdue|hold|critical|shortage|pending|open|review|draft/i.test(record.status)).length;
  const stats = [
    { label: `Total ${config.title.toLowerCase()}`, value: records.length.toLocaleString(), helper: "Live database records" },
    { label: "Recorded value", value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, helper: "Current filtered result" },
    { label: "Active / complete", value: activeCount.toLocaleString(), helper: "Completed or active records" },
    { label: "Needs attention", value: attentionCount.toLocaleString(), helper: "Open, pending, or exception" },
  ];

  const notify = (title: string, description: string, toastVariant: ToastMessage["variant"] = "success") => {
    setToast({ title, description, variant: toastVariant });
    window.setTimeout(() => setToast(null), 3000);
  };

  const exportRows = () => {
    const csv = [["ID", ...config.columns, "Status"], ...records.map((record) => [record.id, record.name, record.secondary, record.amount, record.date, record.status])]
      .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `blue-plastic-${opsModule}-${resource}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Export completed", `${records.length} records downloaded as CSV.`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px]">
        <section className={`overflow-hidden rounded-2xl bg-gradient-to-r ${meta.accent} text-white shadow-sm`}>
          <div className="grid gap-5 px-5 py-6 lg:grid-cols-[1fr_auto] lg:px-7">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Icon size={23}/></span>
              <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">{meta.eyebrow} · {config.title}</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] md:text-[30px]">{config.title}</h1><p className="mt-1 max-w-2xl text-xs leading-5 text-white/65">{config.description}</p></div>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              <button onClick={exportRows} className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold"><Download size={15}/>Export</button>
              <button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold"><Printer size={15}/>Print</button>
              <Link href={`/${opsModule}/${resource}/new`} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold"><Plus size={16}/>{config.primaryAction}</Link>
            </div>
          </div>
          <nav className="flex overflow-x-auto border-t border-white/10 bg-black/10 px-3">
            {Object.values(config.module === "purchasing" ? purchasingTabs : config.module === "inventory" ? inventoryTabs : bankingTabs).map(([slug, label]) => (
              <Link key={slug} href={`/${opsModule}/${slug}`} className={`shrink-0 border-b-2 px-3 py-3 text-[11px] font-semibold ${slug === resource ? "border-sky-300 text-white" : "border-transparent text-white/55 hover:text-white"}`}>{label}</Link>
            ))}
          </nav>
        </section>

        {workflow ? <Card className="mt-4 overflow-x-auto p-4"><div className="flex min-w-[640px] items-center">{workflow.map((label, index) => <div key={label} className="flex flex-1 items-center"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#edf3f6] text-xs font-medium text-[#607681]">{index + 1}</span><div className="ml-2"><p className="text-[10px] font-medium text-[#2c4552]">{label}</p><p className="text-[9px] text-[#8799a3]">Workflow step</p></div>{index < workflow.length - 1 ? <div className="mx-3 h-px flex-1 bg-[#dfe8ed]"/> : null}</div>)}</div></Card> : null}

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => <Card key={stat.label} className="relative overflow-hidden p-4"><span className={`absolute left-0 top-0 h-full w-1 ${["bg-[#007DCC]","bg-emerald-500","bg-amber-500","bg-violet-500"][index]}`}/><p className="text-[10px] font-medium uppercase tracking-wide text-[#788b96]">{stat.label}</p><p className="mt-2 text-xl font-semibold text-[#1f3947]">{stat.value}</p><p className="mt-1 text-[10px] text-[#607681]">{stat.helper}</p></Card>)}
        </section>

        <Card className="mt-4 overflow-hidden">
          <div className="flex flex-col gap-2.5 border-b border-[#e4ebf0] bg-[#fbfcfd] p-3.5 xl:flex-row xl:items-center">
            <div className="relative min-w-[240px] flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82949e]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.searchPlaceholder} className="h-10 w-full rounded-xl border border-[#dce6ed] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#007DCC]"/></div>
            <div className="flex flex-wrap gap-2"><Select value={status} onValueChange={setStatus} options={statuses.length ? statuses : ["All statuses"]} className="h-10 w-[160px] text-xs"/><DatePicker value={from} onChange={setFrom} placeholder="From" className="h-10 w-[140px]"/><DatePicker value={to} onChange={setTo} placeholder="To" className="h-10 w-[140px]"/><button onClick={() => { setSearch(""); setStatus("All statuses"); setFrom(""); setTo(""); }} className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3 text-xs font-bold text-[#526874]"><Filter size={14}/>Reset</button></div>
          </div>
          {error ? <div className="p-10 text-center text-sm text-red-600">{error}</div> : loading ? <LoadingState label={`Loading ${config.title.toLowerCase()}…`} className="m-4"/> :
            resource === "vendors" ? <VendorCenter records={records} onOpen={(id) => router.push(`/${opsModule}/${resource}/${id}`)}/> :
            resource === "approvals" ? <ApprovalCenter records={records} onAction={(record, action) => { void updateStatus(record.id, action === "Approve" ? "Approved" : "Changes requested"); notify(`Request ${action.toLowerCase()}d`, `${record.id} was updated.`); }}/> :
            resource === "fulfillment" ? <FulfillmentCenter records={records} onOpen={(id) => router.push(`/inventory/fulfillment/${id}`)}/> :
            resource === "bank-feeds" ? <BankFeeds records={records} onAction={(record, action) => { void updateStatus(record.id, action); notify(`Transaction ${action.toLowerCase()}`, `${record.name} was updated.`); }}/> :
            resource === "reconciliation" ? <Reconciliation records={records} onFinish={() => notify("Reconciliation finished", "The statement difference is $0.00.")}/> :
            resource === "reorder-planning" ? <ReorderPlanning records={records} onOrder={(record) => notify("Purchase order prepared", `${record.name} was added to a draft purchase order.`)}/> :
            <OperationsTable config={config} records={records} onOpen={(id) => router.push(`/${opsModule}/${resource}/${id}`)} onDelete={setDeleteTarget}/>
          }
        </Card>
      </div>
      <Toast message={toast} onClose={() => setToast(null)}/>
      <ConfirmDeleteDialog open={Boolean(deleteTarget)} title={`Move ${deleteTarget?.id} to Trash?`} recordName={deleteTarget ? `${deleteTarget.id} · ${deleteTarget.name}` : undefined} description="The record remains in the database and can be restored from Trash." onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) void remove(deleteTarget.id); setDeleteTarget(null); notify("Moved to Trash", "The operations workspace has been updated."); }}/>
    </AppShell>
  );
}

const purchasingTabs = [["bills","Bills"],["bill-payments","Pay bills"],["vendors","Vendors"],["purchase-orders","Purchase orders"],["receipts","Item receipts"],["vendor-credits","Vendor credits"],["expenses","Expenses"],["checks","Checks"],["approvals","Approvals"]];
const inventoryTabs = [["items","Items"],["stock-levels","Stock"],["warehouses","Warehouses"],["transfers","Transfers"],["adjustments","Adjustments"],["stock-counts","Cycle counts"],["assemblies","Assemblies / BOM"],["lots-serials","Lots & serials"],["reorder-planning","Reorder"],["fulfillment","Pick · pack · ship"],["landed-costs","Landed costs"]];
const bankingTabs = [["accounts","Accounts"],["bank-feeds","Bank feeds"],["transactions","Transactions"],["bank-rules","Rules"],["deposits","Deposits"],["transfers","Transfers"],["checks","Checks"],["reconciliation","Reconcile"],["cash-flow","Cash flow"]];

function VendorCenter({ records, onOpen }: { records: OperationRecord[]; onOpen: (id: string) => void }) {
  return <div className="grid md:grid-cols-[330px_1fr]"><div className="border-r border-[#e5ecf1] bg-[#f8fafb] p-3">{records.map((record, index) => <button key={record.id} onClick={() => onOpen(record.id)} className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${index === 0 ? "border-[#007DCC] bg-white shadow-sm" : "border-transparent hover:bg-white"}`}><span className="grid size-9 place-items-center rounded-full bg-[#e9f6fd] text-[10px] font-bold text-[#007DCC]">{record.name.split(" ").map((part) => part[0]).slice(0,2)}</span><span className="min-w-0"><strong className="block truncate text-xs">{record.name}</strong><span className="text-[10px] text-[#82949e]">{record.secondary}</span></span><Badge variant={variant(record.status)}>{record.status}</Badge></button>)}</div><div className="p-5"><p className="text-[10px] font-bold uppercase text-[#82949e]">Vendor snapshot</p><div className="mt-2 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-bold">Polymer Gulf LLC</h2><p className="mt-1 text-xs text-[#71848f]">Preferred raw material vendor · Net 30 · USD</p></div><button onClick={() => records[0] && onOpen(records[0].id)} className="rounded-xl bg-[#007DCC] px-3 py-2 text-xs font-bold text-white">Open vendor</button></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{[["Open balance","$31,640"],["Open purchase orders","3"],["On-time delivery","94%"]].map(([label,value]) => <div key={label} className="rounded-xl bg-[#f5f8fa] p-4"><p className="text-[10px] text-[#82949e]">{label}</p><p className="mt-1 text-base font-bold">{value}</p></div>)}</div><h3 className="mt-6 text-xs font-bold">Recent procurement activity</h3>{["PO-1088 partially received","BILL-2088 entered for approval","Credit VC-3018 available"].map((entry) => <div key={entry} className="flex items-center gap-3 border-b border-[#edf1f4] py-3 text-xs"><CheckCircle2 size={15} className="text-emerald-500"/>{entry}<span className="ml-auto text-[10px] text-[#82949e]">Jul 2026</span></div>)}</div></div>;
}

function ApprovalCenter({ records, onAction }: { records: OperationRecord[]; onAction: (record: OperationRecord, action: "Approve" | "Request changes") => void }) {
  return <div className="grid gap-4 p-4 lg:grid-cols-3">{["Awaiting review","Changes requested","Approved"].map((lane) => <section key={lane} className="rounded-2xl bg-[#f5f8fa] p-3"><div className="mb-3 flex items-center gap-2"><ShieldCheck size={16} className="text-[#007DCC]"/><h3 className="text-xs font-bold">{lane}</h3><span className="ml-auto rounded-full bg-white px-2 py-1 text-[9px] font-bold">{records.filter((record) => lane === "Approved" ? record.status === "Approved" : lane === "Changes requested" ? /changes/i.test(record.status) : !/approved|changes/i.test(record.status)).length}</span></div>{records.filter((record) => lane === "Approved" ? record.status === "Approved" : lane === "Changes requested" ? /changes/i.test(record.status) : !/approved|changes/i.test(record.status)).map((record) => <article key={record.id} className="mb-3 rounded-xl border border-[#e0e8ed] bg-white p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold text-[#007DCC]">{record.id}</p><h4 className="mt-1 text-xs font-bold">{record.name}</h4></div><Badge variant={variant(record.status)}>{record.status}</Badge></div><p className="mt-2 text-[10px] text-[#82949e]">{record.secondary} · {record.meta.age}</p><p className="mt-3 text-lg font-bold">{record.amount}</p>{lane === "Awaiting review" ? <div className="mt-3 flex gap-2"><button onClick={() => onAction(record,"Approve")} className="flex-1 rounded-lg bg-emerald-600 py-2 text-[10px] font-bold text-white">Approve</button><button onClick={() => onAction(record,"Request changes")} className="flex-1 rounded-lg border py-2 text-[10px] font-bold">Request changes</button></div> : null}</article>)}</section>)}</div>;
}

function FulfillmentCenter({ records, onOpen }: { records: OperationRecord[]; onOpen: (id: string) => void }) {
  const lanes = [{ label: "Ready to pick", icon: ClipboardCheck }, { label: "Picking", icon: Boxes }, { label: "Packed", icon: PackageCheck }, { label: "Shipped", icon: Truck }];
  return <div className="grid gap-3 p-4 lg:grid-cols-4">{lanes.map(({ label, icon: LaneIcon }) => <section key={label} className="rounded-2xl bg-[#f4f8f7] p-3"><div className="mb-3 flex items-center gap-2 text-[#145448]"><LaneIcon size={16}/><h3 className="text-xs font-bold">{label}</h3></div>{records.filter((record) => record.status === label || (label === "Ready to pick" && record.status === "Backordered")).map((record) => <button key={record.id} onClick={() => onOpen(record.id)} className="mb-2 w-full rounded-xl border border-[#dfe9e6] bg-white p-3 text-left hover:border-emerald-300"><strong className="block text-xs">{record.name}</strong><span className="mt-1 block text-[10px] text-[#7d918b]">{record.secondary} · {record.meta.progress}</span><Badge variant={variant(record.status)}>{record.status}</Badge></button>)}</section>)}</div>;
}

function BankFeeds({ records, onAction }: { records: OperationRecord[]; onAction: (record: OperationRecord, action: string) => void }) {
  return <div className="grid gap-0 lg:grid-cols-[310px_1fr]"><aside className="border-r border-[#e5ecf1] bg-[#f8fafc] p-4"><h3 className="text-xs font-bold">Connected accounts</h3>{["Premier Operating · 2048","Salaam Bank · 1182","Mobile Money · 7712"].map((account,index) => <div key={account} className={`mt-2 rounded-xl border p-3 ${index === 0 ? "border-indigo-300 bg-white" : "border-transparent"}`}><p className="text-xs font-bold">{account}</p><p className="mt-1 text-[10px] text-[#82949e]">{index === 0 ? "12 for review" : "Feed updated today"}</p></div>)}</aside><div className="p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase text-indigo-500">Downloaded transactions</p><h2 className="mt-1 text-base font-bold">Review and categorize</h2></div><button className="rounded-xl border px-3 py-2 text-[10px] font-bold">Update feed</button></div>{records.map((record) => <article key={record.id} className="mb-3 rounded-xl border border-[#e2e9ef] p-4"><div className="grid items-center gap-3 md:grid-cols-[1fr_auto_auto]"><div><p className="text-xs font-bold">{record.name}</p><p className="mt-1 text-[10px] text-[#82949e]">{record.date} · {record.secondary}</p></div><p className="text-sm font-bold">{record.amount}</p><Badge variant={variant(record.status)}>{record.status}</Badge></div>{record.status === "For review" ? <div className="mt-3 flex flex-wrap justify-end gap-2"><button onClick={() => onAction(record,"Excluded")} className="rounded-lg border px-3 py-2 text-[10px] font-bold">Exclude</button><button onClick={() => onAction(record,"Added")} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10px] font-bold text-indigo-700">Add</button><button onClick={() => onAction(record,"Matched")} className="rounded-lg bg-[#007DCC] px-3 py-2 text-[10px] font-bold text-white">Match</button></div> : null}</article>)}</div></div>;
}

function Reconciliation({ records, onFinish }: { records: OperationRecord[]; onFinish: () => void }) {
  const [cleared, setCleared] = useState(() => new Set(records.slice(0, 3).map((record) => record.id)));
  const difference = cleared.size >= 4 ? "$0.00" : "$1,240.00";
  return <div className="p-4"><div className="grid gap-3 md:grid-cols-4">{[["Beginning balance","$241,820.00"],["Ending balance","$284,420.00"],["Cleared balance",cleared.size >= 4 ? "$284,420.00" : "$283,180.00"],["Difference",difference]].map(([label,value],index) => <div key={label} className={`rounded-xl p-4 ${index === 3 ? difference === "$0.00" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700" : "bg-[#f5f8fa]"}`}><p className="text-[10px] font-bold uppercase">{label}</p><p className="mt-1 text-lg font-bold">{value}</p></div>)}</div><div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b bg-[#f8fafc]"><th className="px-4 py-3 text-[9px] uppercase">Clear</th><th className="px-4 py-3 text-[9px] uppercase">Transaction</th><th className="px-4 py-3 text-[9px] uppercase">Account / detail</th><th className="px-4 py-3 text-[9px] uppercase">Date</th><th className="px-4 py-3 text-right text-[9px] uppercase">Amount</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b"><td className="px-4 py-3"><button aria-label={`Clear ${record.id}`} onClick={() => setCleared((current) => { const next = new Set(current); if (next.has(record.id)) next.delete(record.id); else next.add(record.id); return next; })} className={`grid size-6 place-items-center rounded-md border ${cleared.has(record.id) ? "border-[#007DCC] bg-[#007DCC] text-white" : "bg-white"}`}>{cleared.has(record.id) ? <Check size={13}/> : null}</button></td><td className="px-4 py-3 text-xs font-bold">{record.name}</td><td className="px-4 py-3 text-xs text-[#71848f]">{record.secondary}</td><td className="px-4 py-3 text-xs">{record.date}</td><td className="px-4 py-3 text-right text-xs font-bold">{record.amount}</td></tr>)}</tbody></table></div><div className="mt-4 flex justify-end"><button disabled={difference !== "$0.00"} onClick={onFinish} className="rounded-xl bg-[#007DCC] px-5 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-[#aab7bf]">Finish reconciliation</button></div></div>;
}

function ReorderPlanning({ records, onOrder }: { records: OperationRecord[]; onOrder: (record: OperationRecord) => void }) {
  return <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{records.map((record) => <article key={record.id} className="rounded-2xl border border-[#dfe8e4] p-4"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Factory size={18}/></span><Badge variant={variant(record.status)}>{record.status}</Badge></div><h3 className="mt-3 text-sm font-bold">{record.name}</h3><p className="mt-1 text-[10px] text-[#82949e]">{record.secondary}</p><div className="mt-4 rounded-xl bg-[#f5f8f7] p-3"><p className="text-[10px] text-[#82949e]">Suggested order</p><p className="mt-1 text-lg font-bold">{record.meta.suggested}</p></div><button onClick={() => onOrder(record)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#145448] py-2.5 text-[10px] font-bold text-white"><Sparkles size={13}/>Create purchase order</button></article>)}</div>;
}

function OperationsTable({ config, records, onOpen, onDelete }: { config: ResourceConfig; records: OperationRecord[]; onOpen: (id: string) => void; onDelete: (record: OperationRecord) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="bg-[#f8fafc]"><tr>{config.columns.map((column) => <th key={column} className="border-b px-5 py-3 text-[9px] font-bold uppercase tracking-wide text-[#788b96]">{column}</th>)}<th className="border-b px-5 py-3 text-[9px] font-bold uppercase text-[#788b96]">Status</th><th className="border-b px-5 py-3 text-right text-[9px] font-bold uppercase text-[#788b96]">Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} onClick={() => onOpen(record.id)} className="cursor-pointer border-b border-[#edf1f4] hover:bg-[#f2f9fd]"><td className="px-5 py-4"><p className="text-xs font-bold text-[#007DCC]">{record.id}</p><p className="mt-1 text-[10px] text-[#82949e]">{record.reference}</p></td><td className="px-5 py-4"><p className="text-xs font-bold">{record.name}</p><p className="mt-1 text-[10px] text-[#82949e]">{record.secondary}</p></td><td className="px-5 py-4 text-xs font-bold">{record.amount}</td>{config.columns.slice(3).map((column,index) => <td key={column} className="px-5 py-4 text-xs text-[#526874]">{index === 0 ? record.date : Object.values(record.meta)[0] ?? record.date}</td>)}<td className="px-5 py-4"><Badge variant={variant(record.status)}>{record.status}</Badge></td><td onClick={(event) => event.stopPropagation()} className="px-5 py-4 text-right"><button aria-label={`Delete ${record.id}`} onClick={() => onDelete(record)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={15}/></button><button aria-label={`Open ${record.id}`} onClick={() => onOpen(record.id)} className="rounded-lg p-2 text-[#007DCC]"><ArrowRight size={15}/></button></td></tr>)}</tbody></table>{!records.length ? <div className="p-16 text-center text-sm text-[#71848f]">No matching records found.</div> : null}</div>;
}
