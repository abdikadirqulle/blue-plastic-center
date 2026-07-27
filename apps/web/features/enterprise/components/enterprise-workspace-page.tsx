"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight, BriefcaseBusiness, Calculator, CheckCircle2,
  Clock3, Download, Filter, Landmark, LockKeyhole, Plus,
  Printer, Search, Trash2, WalletCards,
} from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { ConfirmDeleteDialog } from "../../../components/ui/confirm-delete-dialog";
import { Select } from "../../../components/ui/select";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import type { ResourceConfig } from "../../resources/resource-config";
import type { EnterpriseModule, EnterpriseRecord } from "../domain/enterprise-record";
import { useEnterpriseRecords } from "../hooks/use-enterprise-records";

const tabs = {
  accounting: [["chart-of-accounts","Accounts"],["journal-entries","Journals"],["registers","Registers"],["recurring","Recurring"],["fiscal-periods","Periods"],["close-center","Close center"],["budgets","Budgets"],["fixed-assets","Fixed assets"],["classes","Classes"],["audit-log","Audit log"]],
  projects: [["projects","Project center"],["tasks","Tasks"],["time","Time"],["expenses","Costs"],["progress-billing","Progress billing"],["change-orders","Change orders"],["profitability","Profitability"]],
  payroll: [["pay-runs","Pay runs"],["employees","Employees"],["timesheets","Timesheets"],["leave","Leave"],["loans","Loans"],["liabilities","Liabilities"],["benefits","Benefits"],["reports","Reports"]],
} satisfies Record<EnterpriseModule, string[][]>;

const meta = {
  accounting: { label: "General ledger & controls", icon: Calculator, gradient: "linear-gradient(120deg, #143c5a 0%, #08263a 100%)" },
  projects: { label: "Projects & job costing", icon: BriefcaseBusiness, gradient: "linear-gradient(120deg, #4c326d 0%, #25233f 100%)" },
  payroll: { label: "Payroll & workforce", icon: WalletCards, gradient: "linear-gradient(120deg, #265648 0%, #173830 100%)" },
};

const stats: Record<EnterpriseModule, ResourceConfig["stats"]> = {
  accounting: [{ label: "Unposted journals", value: "7", helper: "$42,880 total" }, { label: "Close progress", value: "72%", helper: "July 2026" }, { label: "Budget variance", value: "+$12,400", helper: "Favorable MTD" }, { label: "Net book value", value: "$684,200", helper: "42 fixed assets" }],
  projects: [{ label: "Active projects", value: "12", helper: "$1.84M contract value" }, { label: "Unbilled costs", value: "$48,620", helper: "5 projects" }, { label: "Gross margin", value: "31.4%", helper: "+2.1% vs budget" }, { label: "At risk", value: "3", helper: "$284K exposure" }],
  payroll: [{ label: "Next payroll", value: "$45,120", helper: "52 employees" }, { label: "Liabilities due", value: "$12,840", helper: "Due 31 Jul" }, { label: "Timesheet exceptions", value: "6", helper: "Needs manager review" }, { label: "Leave liability", value: "$18,200", helper: "428 accrued days" }],
};

const badgeVariant = (status: string) => {
  if (/posted|active|approved|complete|paid|service|profitable|reconciled|closed|ready/i.test(status)) return "success";
  if (/blocked|risk|over budget|rejected|locked|inactive/i.test(status)) return "danger";
  if (/pending|open|draft|review|progress|processing|due|maintenance|leave/i.test(status)) return "warning";
  return "neutral";
};

export function EnterpriseWorkspacePage({ config }: { config: ResourceConfig }) {
  const router = useRouter();
  const enterpriseModule = config.module as EnterpriseModule;
  const resource = config.slug;
  const moduleMeta = meta[enterpriseModule];
  const Icon = moduleMeta.icon;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [deleteTarget, setDeleteTarget] = useState<EnterpriseRecord | null>(null);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const { records, loading, error, updateStatus, remove } = useEnterpriseRecords(enterpriseModule, resource, search, status);
  const statusOptions = useMemo(() => ["All statuses", ...Array.from(new Set(records.map((record) => record.status)))], [records]);
  const notify = (title: string, description: string) => {
    setMessage({ title, description, variant: "success" });
    window.setTimeout(() => setMessage(null), 3000);
  };

  return <AppShell>
    <div className="mx-auto max-w-[1600px]">
      <section className="overflow-hidden rounded-2xl text-white shadow-sm" style={{ background: moduleMeta.gradient }}>
        <div className="grid gap-5 px-5 py-6 lg:grid-cols-[1fr_auto] lg:px-7">
          <div className="flex gap-4"><span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15"><Icon size={23}/></span><div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">{moduleMeta.label}</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] md:text-[30px]">{config.title}</h1><p className="mt-1 max-w-2xl text-xs text-white/65">{config.description}</p></div></div>
          <div className="flex flex-wrap items-center gap-2"><button onClick={() => notify("Export prepared", `${records.length} records are ready.`)} className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold"><Download size={15}/>Export</button><button onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-xs font-bold"><Printer size={15}/>Print</button><Link href={`/${enterpriseModule}/${resource}/new`} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold"><Plus size={15}/>{config.primaryAction}</Link></div>
        </div>
        <nav className="flex overflow-x-auto border-t border-white/10 bg-black/10 px-3">{tabs[enterpriseModule].map(([slug,label]) => <Link key={slug} href={`/${enterpriseModule}/${slug}`} className={`shrink-0 border-b-2 px-3 py-3 text-[11px] font-semibold ${slug === resource ? "border-sky-300 text-white" : "border-transparent text-white/55"}`}>{label}</Link>)}</nav>
      </section>
      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{stats[enterpriseModule].map((stat,index) => <Card key={stat.label} className="relative overflow-hidden p-4"><span className={`absolute inset-y-0 left-0 w-1 ${["bg-[#007DCC]","bg-emerald-500","bg-amber-500","bg-violet-500"][index]}`}/><p className="text-[10px] font-bold uppercase text-[#788b96]">{stat.label}</p><p className="mt-2 text-xl font-bold">{stat.value}</p><p className="mt-1 text-[10px] text-[#007DCC]">{stat.helper}</p></Card>)}</section>
      <Card className="mt-4 overflow-hidden">
        <div className="flex flex-col gap-2 border-b bg-[#fbfcfd] p-3.5 lg:flex-row"><div className="relative flex-1"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82949e]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.searchPlaceholder} className="h-10 w-full rounded-xl border border-[#dce6ed] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#007DCC]"/></div><Select value={status} onValueChange={setStatus} options={statusOptions.length ? statusOptions : ["All statuses"]} className="h-10 w-[170px] text-xs"/><button onClick={() => { setSearch(""); setStatus("All statuses"); }} className="flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold"><Filter size={14}/>Reset</button></div>
        {error ? <div className="p-10 text-center text-red-600">{error}</div> : loading ? <div className="p-12 text-center text-sm text-[#71848f]">Loading enterprise workspace…</div> :
          resource === "chart-of-accounts" ? <AccountCenter records={records} onOpen={(id) => router.push(`/accounting/chart-of-accounts/${id}`)}/> :
          resource === "close-center" ? <CloseCenter records={records} onComplete={(record) => { void updateStatus(record.id, "Complete"); notify("Close task completed", record.name); }}/> :
          resource === "budgets" ? <BudgetCenter records={records} onOpen={(id) => router.push(`/accounting/budgets/${id}`)}/> :
          resource === "fixed-assets" ? <FixedAssetCenter records={records} onDepreciate={(record) => notify("Depreciation posted", `${record.name} was included in JE-3094.`)}/> :
          resource === "projects" || resource === "profitability" ? <ProjectCenter records={records} onOpen={(id) => router.push(`/${enterpriseModule}/${resource}/${id}`)}/> :
          resource === "pay-runs" ? <PayRunCenter records={records} onApprove={(record) => { void updateStatus(record.id, "Approved"); notify("Payroll approved", `${record.name} is ready for payment.`); }}/> :
          resource === "employees" ? <EmployeeCenter records={records} onOpen={(id) => router.push(`/payroll/employees/${id}`)}/> :
          resource === "audit-log" ? <AuditTimeline records={records}/> :
          <EnterpriseTable config={config} records={records} onOpen={(id) => router.push(`/${enterpriseModule}/${resource}/${id}`)} onDelete={setDeleteTarget}/>}
      </Card>
    </div>
    <Toast message={message} onClose={() => setMessage(null)}/>
    <ConfirmDeleteDialog open={Boolean(deleteTarget)} title={`Delete ${deleteTarget?.id}?`} recordName={deleteTarget?.name} description="This record will be removed through the enterprise repository contract." onClose={() => setDeleteTarget(null)} onConfirm={() => { if (deleteTarget) void remove(deleteTarget.id); setDeleteTarget(null); notify("Record deleted", "The workspace was updated."); }}/>
  </AppShell>;
}

function AccountCenter({ records, onOpen }: { records: EnterpriseRecord[]; onOpen: (id: string) => void }) {
  return <div className="grid md:grid-cols-[280px_1fr]"><aside className="border-r bg-[#f8fafc] p-4"><p className="text-[10px] font-bold uppercase text-[#82949e]">Account types</p>{[["Assets","$684,200"],["Liabilities","$184,420"],["Equity","$248,900"],["Income","$926,400"],["Expenses","$512,800"]].map(([label,value],index) => <div key={label} className={`mt-2 rounded-xl border p-3 ${index === 0 ? "border-sky-300 bg-white" : "border-transparent"}`}><p className="text-xs font-bold">{label}</p><p className="mt-1 text-[10px] text-[#82949e]">{value}</p></div>)}</aside><div className="p-4"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-bold">Chart of accounts</h2><p className="text-[10px] text-[#82949e]">Hierarchical general-ledger accounts and balances</p></div><Badge variant="success">Balanced</Badge></div>{records.map((record,index) => <button key={record.id} onClick={() => onOpen(record.id)} className="flex w-full items-center gap-3 border-b px-2 py-3 text-left hover:bg-[#f6fafc]"><span className="font-mono text-[10px] font-bold text-[#007DCC]">{1000 + index * 100}</span><span className="min-w-0 flex-1"><strong className="block text-xs">{record.name}</strong><span className="text-[10px] text-[#82949e]">{record.detail}</span></span><span className="text-xs font-bold">{record.value}</span><ArrowRight size={14}/></button>)}</div></div>;
}

function CloseCenter({ records, onComplete }: { records: EnterpriseRecord[]; onComplete: (record: EnterpriseRecord) => void }) {
  return <div className="p-4"><div className="mb-4 rounded-2xl bg-[#eef7fd] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase text-[#007DCC]">July 2026 close</p><h2 className="mt-1 text-lg font-bold">72% complete · 8 days remaining</h2></div><button className="rounded-xl bg-[#007DCC] px-4 py-2.5 text-xs font-bold text-white">Review close exceptions</button></div><div className="mt-3 h-2 rounded-full bg-white"><div className="h-full w-[72%] rounded-full bg-[#007DCC]"/></div></div><div className="grid gap-3 lg:grid-cols-3">{["Reconcile","Review","Finalize"].map((lane) => <section key={lane} className="rounded-2xl bg-[#f6f8fa] p-3"><h3 className="mb-3 flex items-center gap-2 text-xs font-bold"><LockKeyhole size={15} className="text-[#007DCC]"/>{lane}</h3>{records.filter((_,index) => lane === "Reconcile" ? index < 2 : lane === "Review" ? index >= 2 && index < 4 : index === 4).map((record) => <article key={record.id} className="mb-2 rounded-xl border bg-white p-3"><div className="flex items-start justify-between gap-2"><p className="text-xs font-bold">{record.name}</p><Badge variant={badgeVariant(record.status)}>{record.status}</Badge></div><p className="mt-2 text-[10px] text-[#82949e]">{record.date} · Owner: Finance</p>{record.status !== "Complete" ? <button onClick={() => onComplete(record)} className="mt-3 w-full rounded-lg bg-[#eaf5fc] py-2 text-[10px] font-bold text-[#007DCC]">Mark complete</button> : null}</article>)}</section>)}</div></div>;
}

function BudgetCenter({ records, onOpen }: { records: EnterpriseRecord[]; onOpen: (id: string) => void }) {
  return <div className="p-4"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b bg-[#f8fafc]">{["Budget","Annual budget","YTD actual","YTD budget","Variance","Progress"].map((item) => <th key={item} className="px-4 py-3 text-[9px] uppercase text-[#788b96]">{item}</th>)}</tr></thead><tbody>{records.map((record,index) => <tr key={record.id} onClick={() => onOpen(record.id)} className="cursor-pointer border-b hover:bg-[#f3f9fd]"><td className="px-4 py-4"><p className="text-xs font-bold">{record.name}</p><p className="text-[10px] text-[#82949e]">{record.status}</p></td><td className="px-4 py-4 text-xs font-bold">{record.value}</td><td className="px-4 py-4 text-xs">{["$164,200","$98,400","$72,800","$44,200","$184,000"][index]}</td><td className="px-4 py-4 text-xs">{["$151,800","$106,650","$68,620","$60,960","$184,000"][index]}</td><td className={`px-4 py-4 text-xs font-bold ${record.metrics.variance.startsWith("-") ? "text-red-600" : "text-emerald-600"}`}>{record.metrics.variance}</td><td className="px-4 py-4"><div className="h-2 w-28 rounded-full bg-[#edf2f5]"><div className="h-full rounded-full bg-[#007DCC]" style={{ width: record.metrics.progress }}/></div></td></tr>)}</tbody></table></div></div>;
}

function FixedAssetCenter({ records, onDepreciate }: { records: EnterpriseRecord[]; onDepreciate: (record: EnterpriseRecord) => void }) {
  return <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{records.map((record,index) => <article key={record.id} className="rounded-2xl border p-4"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700"><Landmark size={18}/></span><Badge variant={badgeVariant(record.status)}>{record.status}</Badge></div><h3 className="mt-3 text-sm font-bold">{record.name}</h3><p className="mt-1 text-[10px] text-[#82949e]">Asset no. FA-{1048 + index} · Straight line</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl bg-[#f6f8fa] p-3"><p className="text-[9px] text-[#82949e]">Cost</p><p className="mt-1 text-xs font-bold">{record.value}</p></div><div className="rounded-xl bg-[#f6f8fa] p-3"><p className="text-[9px] text-[#82949e]">Net book value</p><p className="mt-1 text-xs font-bold">{["$242,180","$84,220","$184,000","$36,400","$18,900"][index]}</p></div></div><button onClick={() => onDepreciate(record)} className="mt-3 w-full rounded-xl bg-indigo-50 py-2.5 text-[10px] font-bold text-indigo-700">Post depreciation</button></article>)}</div>;
}

function ProjectCenter({ records, onOpen }: { records: EnterpriseRecord[]; onOpen: (id: string) => void }) {
  return <div className="grid gap-3 p-4 lg:grid-cols-2">{records.map((record,index) => <article key={record.id} className="rounded-2xl border p-4"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold text-violet-700">{record.id}</p><h3 className="mt-1 text-sm font-bold">{record.name}</h3><p className="mt-1 text-[10px] text-[#82949e]">{record.detail}</p></div><Badge variant={badgeVariant(record.status)}>{record.status}</Badge></div><div className="mt-4 grid grid-cols-3 gap-2">{[["Contract",record.value],["Cost to date",["$182K","$94K","$68K","$42K","$128K"][index]],["Margin",["34%","18%","42%","22%","31%"][index]]].map(([label,value]) => <div key={label} className="rounded-xl bg-[#f7f5fa] p-3"><p className="text-[9px] text-[#82949e]">{label}</p><p className="mt-1 text-xs font-bold">{value}</p></div>)}</div><div className="mt-3 h-2 rounded-full bg-[#edf0f2]"><div className="h-full rounded-full bg-violet-600" style={{ width: record.metrics.progress }}/></div><button onClick={() => onOpen(record.id)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[10px] font-bold text-violet-700">Open job cost center <ArrowRight size={13}/></button></article>)}</div>;
}

function PayRunCenter({ records, onApprove }: { records: EnterpriseRecord[]; onApprove: (record: EnterpriseRecord) => void }) {
  return <div className="p-4"><div className="mb-4 grid gap-2 sm:grid-cols-4">{["Enter time","Review payroll","Approve","Pay & file"].map((label,index) => <div key={label} className={`rounded-xl p-3 ${index < 2 ? "bg-emerald-50 text-emerald-700" : "bg-[#f5f8fa]"}`}><div className="flex items-center gap-2">{index < 2 ? <CheckCircle2 size={15}/> : <Clock3 size={15}/>}<p className="text-[10px] font-bold">{label}</p></div></div>)}</div>{records.map((record) => <article key={record.id} className="mb-3 grid items-center gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto_auto_auto]"><div><p className="text-xs font-bold">{record.name}</p><p className="mt-1 text-[10px] text-[#82949e]">{record.id} · Pay date {record.date}</p></div><div><p className="text-[9px] text-[#82949e]">Net pay</p><p className="text-sm font-bold">{record.value}</p></div><Badge variant={badgeVariant(record.status)}>{record.status}</Badge>{record.status === "Ready to approve" ? <button onClick={() => onApprove(record)} className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white">Approve payroll</button> : <button className="rounded-xl border px-3 py-2 text-[10px] font-bold">View run</button>}</article>)}</div>;
}

function EmployeeCenter({ records, onOpen }: { records: EnterpriseRecord[]; onOpen: (id: string) => void }) {
  return <div className="grid md:grid-cols-[310px_1fr]"><aside className="border-r bg-[#f8fafc] p-3">{records.map((record,index) => <button key={record.id} onClick={() => onOpen(record.id)} className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${index === 0 ? "border-emerald-300 bg-white" : "border-transparent"}`}><span className="grid size-9 place-items-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">{record.name.split(" ").map((part) => part[0]).join("")}</span><span><strong className="block text-xs">{record.name}</strong><span className="text-[10px] text-[#82949e]">{record.status}</span></span></button>)}</aside><div className="p-5"><p className="text-[10px] font-bold uppercase text-emerald-700">Employee profile</p><h2 className="mt-1 text-xl font-bold">Ahmed Hassan</h2><p className="mt-1 text-xs text-[#71848f]">Production Supervisor · Employee EMP-1001</p><div className="mt-5 grid gap-3 sm:grid-cols-3">{[["YTD gross pay","$18,420"],["Leave balance","14 days"],["Next net pay","$2,180"]].map(([label,value]) => <div key={label} className="rounded-xl bg-[#f5f8f7] p-4"><p className="text-[10px] text-[#82949e]">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>)}</div><h3 className="mt-6 text-xs font-bold">Payroll & HR activity</h3>{["Timesheet approved · Week 30","July payroll calculated","Annual leave request approved"].map((text) => <div key={text} className="flex items-center gap-3 border-b py-3 text-xs"><CheckCircle2 size={15} className="text-emerald-600"/>{text}<span className="ml-auto text-[10px] text-[#82949e]">Jul 2026</span></div>)}</div></div>;
}

function AuditTimeline({ records }: { records: EnterpriseRecord[] }) {
  return <div className="p-5"><div className="relative ml-3 border-l border-[#dfe7ec] pl-6">{records.map((record,index) => <article key={record.id} className="relative mb-5 rounded-xl border p-4"><span className="absolute -left-[31px] top-5 grid size-3 rounded-full border-2 border-white bg-[#007DCC]"/><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold">{record.name}</p><p className="mt-1 text-[10px] text-[#82949e]">Abdisalam · {record.date} · 10:{24 + index}</p></div><Badge variant={badgeVariant(record.status)}>{record.status}</Badge></div><p className="mt-3 rounded-lg bg-[#f7f9fa] p-3 text-[10px] text-[#607680]">Change captured with before/after values, company, branch, user, IP address and immutable event ID {record.id}.</p></article>)}</div></div>;
}

function EnterpriseTable({ config, records, onOpen, onDelete }: { config: ResourceConfig; records: EnterpriseRecord[]; onOpen: (id: string) => void; onDelete: (record: EnterpriseRecord) => void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="border-b bg-[#f8fafc]">{config.columns.map((column) => <th key={column} className="px-5 py-3 text-[9px] font-bold uppercase text-[#788b96]">{column}</th>)}<th className="px-5 py-3 text-[9px] uppercase">Status</th><th className="px-5 py-3 text-right text-[9px] uppercase">Actions</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} onClick={() => onOpen(record.id)} className="cursor-pointer border-b hover:bg-[#f3f9fd]"><td className="px-5 py-4"><p className="text-xs font-bold text-[#007DCC]">{record.id}</p><p className="text-[10px] text-[#82949e]">{record.date}</p></td><td className="px-5 py-4"><p className="text-xs font-bold">{record.name}</p><p className="text-[10px] text-[#82949e]">{record.detail}</p></td><td className="px-5 py-4 text-xs font-bold">{record.value}</td>{config.columns.slice(3).map((column,index) => <td key={column} className="px-5 py-4 text-xs">{index === 0 ? record.date : record.metrics.progress}</td>)}<td className="px-5 py-4"><Badge variant={badgeVariant(record.status)}>{record.status}</Badge></td><td onClick={(event) => event.stopPropagation()} className="px-5 py-4 text-right"><button aria-label={`Delete ${record.id}`} onClick={() => onDelete(record)} className="rounded-lg p-2 text-red-500"><Trash2 size={15}/></button><button aria-label={`Open ${record.id}`} onClick={() => onOpen(record.id)} className="rounded-lg p-2 text-[#007DCC]"><ArrowRight size={15}/></button></td></tr>)}</tbody></table></div>;
}
