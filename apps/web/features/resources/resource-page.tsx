"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Search,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { AppShell } from "../../components/layout/app-shell";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { DatePicker } from "../../components/ui/date-picker";
import { Select } from "../../components/ui/select";
import { Toast, type ToastMessage, type ToastVariant } from "../../components/ui/toast";
import { cn } from "../../lib/utils";
import {
  moduleDefinitions,
  type ResourceConfig,
} from "./resource-config";

const badgeVariant = (status: string) => {
  if (["Paid", "Posted", "Active", "Approved", "Completed"].includes(status)) return "success";
  if (["Overdue", "Rejected", "Low stock"].includes(status)) return "danger";
  if (["Pending", "Open", "Partially paid"].includes(status)) return "warning";
  return "neutral";
};

export function ResourcePage({ config }: { config: ResourceConfig }) {
  const router = useRouter();
  const moduleDefinition = moduleDefinitions[config.module];
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [keyValue, setKeyValue] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState(config.rows);
  const [menuRow, setMenuRow] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const text = `${row.id} ${row.cells.join(" ")}`.toLowerCase();
        const rowDate = Date.parse(row.cells[2] ?? "");
        const afterFrom = !dateFrom || (!Number.isNaN(rowDate) && rowDate >= Date.parse(dateFrom));
        const beforeTo = !dateTo || (!Number.isNaN(rowDate) && rowDate <= Date.parse(dateTo));
        return text.includes(search.toLowerCase())
          && (status === "All statuses" || row.status === status)
          && (keyValue === "All" || row.cells[0] === keyValue)
          && afterFrom
          && beforeTo;
      }),
    [rows, search, status, keyValue, dateFrom, dateTo],
  );

  const notify = (title: string, variant: ToastVariant = "info", description?: string) => {
    setToast({ title, variant, description });
    window.setTimeout(() => setToast(null), 3200);
  };

  const exportRows = () => {
    const csv = [
      ["ID", ...config.columns, "Status"].join(","),
      ...filteredRows.map((row) => [row.id, ...row.cells, row.status].map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `al-furat-${config.module}-${config.slug}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Export completed", "success", `${filteredRows.length} filtered ${config.title.toLowerCase()} downloaded as CSV.`);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-bold text-[#007DCC]">{config.moduleTitle}</p>
            <h1 className="text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">{config.title}</h1>
            <p className="mt-1.5 max-w-2xl text-sm text-[#6b7e8a]">{config.description}</p>
          </div>
          <div className="flex gap-2">
            <Link href={`/${config.module}/${config.slug}/new`} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white hover:bg-[#0069ad]">
              <Plus size={17} /> {config.primaryAction}
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {config.stats.map((stat) => (
            <Card key={stat.label} className="p-4">
              <p className="text-xs font-semibold text-[#71848f]">{stat.label}</p>
              <p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#17303d]">{stat.value}</p>
              <p className="mt-1 text-[11px] font-medium text-[#007DCC]">{stat.helper}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-4 overflow-visible">
          <nav className="overflow-x-auto border-b border-[#e5ecf1] px-4">
            <div className="flex min-w-max gap-1">
              {moduleDefinition.resources.map((resource) => (
                <Link
                  key={resource.slug}
                  href={`/${config.module}/${resource.slug}`}
                  className={cn(
                    "border-b-2 px-3 py-4 text-xs font-bold",
                    resource.slug === config.slug
                      ? "border-[#007DCC] text-[#007DCC]"
                      : "border-transparent text-[#728691] hover:text-[#2e4653]",
                  )}
                >
                  {resource.label}
                </Link>
              ))}
            </div>
          </nav>

          <div className="flex flex-wrap gap-3 border-b border-[#e5ecf1] p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8496a1]" size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.searchPlaceholder} className="h-10 w-full min-w-[220px] rounded-xl border border-[#dce6ed] bg-[#f8fafc] pl-9 pr-3 text-xs outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10" />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#71848f]" size={15} />
              <Select value={status} onValueChange={setStatus} options={["All statuses","Active","Paid","Posted","Pending","Draft","Overdue"]} className="h-10 min-w-40 pl-9 text-xs font-semibold"/>
            </div>
            <Select value={keyValue} onValueChange={setKeyValue} options={["All", ...Array.from(new Set(rows.map((row) => row.cells[0])))]} placeholder={`All ${config.columns[1]?.toLowerCase() ?? "records"}`} className="h-10 text-xs font-semibold"/>
            <DatePicker value={dateFrom} onChange={setDateFrom} placeholder="From date" className="h-10 text-xs"/>
            <DatePicker value={dateTo} onChange={setDateTo} placeholder="To date" className="h-10 text-xs"/>
            <button onClick={() => { setSearch(""); setStatus("All statuses"); setKeyValue("All"); setDateFrom(""); setDateTo(""); notify("Filters reset", "info", "All records are visible again."); }} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6ed] px-3 text-xs font-semibold text-[#526874]">
              <SlidersHorizontal size={15} /> Reset
            </button>
            <button onClick={exportRows} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3 text-xs font-bold text-[#526874] hover:border-[#007DCC] hover:text-[#007DCC]"><Download size={15}/> Export</button>
            <button onClick={() => { window.print(); notify("Print dialog opened", "info", `Printing ${filteredRows.length} filtered records.`); }} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3 text-xs font-bold text-[#526874] hover:border-[#007DCC] hover:text-[#007DCC]"><Printer size={15}/> Print</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="bg-[#f8fafc]">
                  {config.columns.map((column) => <th key={column} className="border-b border-[#e5ecf1] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#788b96]">{column}</th>)}
                  <th className="border-b border-[#e5ecf1] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#788b96]">Status</th>
                  <th className="border-b border-[#e5ecf1] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[#788b96]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    onClick={() => router.push(`/${config.module}/${config.slug}/${encodeURIComponent(row.id)}`)}
                    onKeyDown={(event) => { if (event.key === "Enter") router.push(`/${config.module}/${config.slug}/${encodeURIComponent(row.id)}`); }}
                    className="cursor-pointer border-b border-[#edf1f4] outline-none hover:bg-[#f0f8fd] focus:bg-[#f0f8fd]"
                  >
                    <td className="px-5 py-4 text-xs font-bold text-[#007DCC]">{row.id}</td>
                    {row.cells.slice(0, config.columns.length - 1).map((cell, index) => (
                      <td key={`${row.id}-${index}`} className="px-5 py-4 text-xs font-semibold text-[#334b57]">
                        {index === 0 ? <><p>{cell}</p><p className="mt-1 text-[10px] font-normal text-[#83949e]">Main company · Main branch</p></> : cell}
                      </td>
                    ))}
                    <td className="px-5 py-4"><Badge variant={badgeVariant(row.status)}>{row.status}</Badge></td>
                    <td className="relative px-5 py-4 text-right" onClick={(event) => event.stopPropagation()}>
                      <button aria-label={`Actions for ${row.id}`} onClick={() => setMenuRow(menuRow === row.id ? null : row.id)} className="rounded-lg p-2 text-[#78909d] hover:bg-[#e9f4fb] hover:text-[#007DCC]"><MoreHorizontal size={17} /></button>
                      {menuRow === row.id ? (
                        <div className="absolute right-8 top-12 z-20 w-36 rounded-xl border border-[#dce6ed] bg-white p-1.5 text-left shadow-xl">
                          <Link href={`/${config.module}/${config.slug}/${encodeURIComponent(row.id)}`} onClick={() => setMenuRow(null)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold hover:bg-[#eef7fd]"><Eye size={14}/> View details</Link>
                          <Link href={`/${config.module}/${config.slug}/new?edit=${encodeURIComponent(row.id)}`} onClick={() => setMenuRow(null)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold hover:bg-[#eef7fd]"><Pencil size={14}/> Edit</Link>
                          <button onClick={() => { if (window.confirm(`Delete ${row.id}?`)) { setRows((current) => current.filter((item) => item.id !== row.id)); notify("Record deleted", "success", `${row.id} was removed successfully.`); } setMenuRow(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><Trash2 size={14}/> Delete</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filteredRows.length ? <div className="py-16 text-center text-sm font-semibold text-[#71848f]">No matching records found.</div> : null}
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[11px] text-[#7b8d97]">Showing {filteredRows.length} of {rows.length} records</p>
            <div className="flex gap-1">
              <button aria-label="Previous page" onClick={() => notify("You are on the first page")} className="grid size-8 place-items-center rounded-lg border border-[#dce6ed]"><ChevronLeft size={15}/></button>
              <button className="grid size-8 place-items-center rounded-lg bg-[#007DCC] text-xs font-bold text-white">1</button>
              <button aria-label="Next page" onClick={() => notify("No more records in this preview")} className="grid size-8 place-items-center rounded-lg border border-[#dce6ed]"><ChevronRight size={15}/></button>
            </div>
          </div>
        </Card>
      </div>

      <Toast message={toast} onClose={() => setToast(null)}/>
    </AppShell>
  );
}
