"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Filter,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { AppShell } from "../../components/layout/app-shell";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import type { WorkspaceConfig, WorkspaceRow } from "./config";
import { workspaceConfigs } from "./config";

const statusVariant = {
  Active: "success",
  Paid: "success",
  Posted: "success",
  Pending: "warning",
  Draft: "neutral",
  Overdue: "danger",
  "Low stock": "danger",
} as const;

export function WorkspacePage({ section }: { section: string }) {
  const config: WorkspaceConfig = workspaceConfigs[section];
  const searchParams = useSearchParams();
  const requestedCreate = searchParams.get("create");
  const requestedSearch = searchParams.get("search") ?? "";
  const [activeTab, setActiveTab] = useState(config.tabs[0]);
  const [search, setSearch] = useState(requestedSearch);
  const [status, setStatus] = useState("All statuses");
  const [rows, setRows] = useState(config.rows);
  const [formOpen, setFormOpen] = useState(Boolean(requestedCreate));
  const [detailRow, setDetailRow] = useState<WorkspaceRow | null>(null);
  const [editRow, setEditRow] = useState<WorkspaceRow | null>(null);
  const [menuRow, setMenuRow] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const matchesSearch = `${row.id} ${row.primary} ${row.secondary}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesStatus = status === "All statuses" || row.status === status;
        return matchesSearch && matchesStatus;
      }),
    [rows, search, status],
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const values = config.formFields.map((field) => String(data.get(field) ?? ""));
    if (editRow) {
      setRows((current) =>
        current.map((row) =>
          row.id === editRow.id
            ? { ...row, primary: values[0] || row.primary, secondary: values[1] || row.secondary }
            : row,
        ),
      );
      notify(`${editRow.id} was updated`);
    } else {
      setRows((current) => [
        {
          id: `${config.slug.slice(0, 3).toUpperCase()}-${String(current.length + 101).padStart(4, "0")}`,
          primary: values[0] || `New ${config.primaryAction.toLowerCase()}`,
          secondary: values[1] || "Main branch",
          value: values.at(-1) || "$0.00",
          status: "Draft",
          date: "25 Jul 2026",
        },
        ...current,
      ]);
      notify(`${config.primaryAction} created as draft`);
    }
    setFormOpen(false);
    setEditRow(null);
  };

  const exportRows = () => {
    const csv = [
      config.columns.join(","),
      ...filteredRows.map((row) =>
        [row.id, row.primary, row.value, row.status, row.date]
          .map((value) => `"${value.replaceAll('"', '""')}"`)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `al-furat-${config.slug}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("CSV export downloaded");
  };

  const Icon = config.icon;

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#007DCC]">
              <Icon size={16} /> Al-Furat workspace
            </div>
            <h1 className="text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">
              {config.title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-[#6b7e8a]">{config.description}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportRows}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3.5 text-xs font-bold text-[#425966] hover:bg-[#f5f9fc]"
            >
              <Download size={16} /> Export
            </button>
            <button
              type="button"
              onClick={() => {
                setEditRow(null);
                setFormOpen(true);
              }}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white hover:bg-[#0069ad]"
            >
              <Plus size={17} /> {config.primaryAction}
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {config.stats.map((item) => (
            <Card key={item.label} className="p-4">
              <p className="text-xs font-semibold text-[#71848f]">{item.label}</p>
              <p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#17303d]">{item.value}</p>
              <p className="mt-1 text-[11px] font-medium text-[#007DCC]">{item.helper}</p>
            </Card>
          ))}
        </div>

        <Card className="mt-4 overflow-visible">
          <div className="overflow-x-auto border-b border-[#e5ecf1] px-4">
            <div className="flex min-w-max gap-1">
              {config.tabs.map((tab) => (
                <button
                  type="button"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "border-b-2 px-3 py-4 text-xs font-bold transition",
                    activeTab === tab
                      ? "border-[#007DCC] text-[#007DCC]"
                      : "border-transparent text-[#728691] hover:text-[#2e4653]",
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 border-b border-[#e5ecf1] p-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8496a1]" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                className="h-10 w-full rounded-xl border border-[#dce6ed] bg-[#f8fafc] pl-9 pr-3 text-xs outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"
              />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#71848f]" size={15} />
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="h-10 appearance-none rounded-xl border border-[#dce6ed] bg-white pl-9 pr-8 text-xs font-semibold text-[#526874] outline-none"
              >
                <option>All statuses</option>
                {Object.keys(statusVariant).map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("All statuses");
                notify("Filters reset");
              }}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6ed] px-3 text-xs font-semibold text-[#526874]"
            >
              <SlidersHorizontal size={15} /> Reset
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="bg-[#f8fafc]">
                  {config.columns.map((column) => (
                    <th key={column} className="border-b border-[#e5ecf1] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#788b96]">{column}</th>
                  ))}
                  <th className="border-b border-[#e5ecf1] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[#788b96]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="group border-b border-[#edf1f4] hover:bg-[#f8fbfd]">
                    <td className="px-5 py-4 text-xs font-bold text-[#007DCC]">{row.id}</td>
                    <td className="px-5 py-4"><p className="text-xs font-bold text-[#2e4551]">{row.primary}</p><p className="mt-1 text-[10px] text-[#83949e]">{row.secondary}</p></td>
                    <td className="px-5 py-4 text-xs font-bold text-[#2e4551]">{row.value}</td>
                    <td className="px-5 py-4"><Badge variant={statusVariant[row.status]}>{row.status}</Badge></td>
                    <td className="px-5 py-4 text-xs text-[#657a85]">{row.date}</td>
                    <td className="relative px-5 py-4 text-right">
                      <button
                        aria-label={`Actions for ${row.id}`}
                        onClick={() => setMenuRow(menuRow === row.id ? null : row.id)}
                        className="rounded-lg p-2 text-[#78909d] hover:bg-[#e9f4fb] hover:text-[#007DCC]"
                      >
                        <MoreHorizontal size={17} />
                      </button>
                      {menuRow === row.id ? (
                        <div className="absolute right-8 top-12 z-20 w-36 rounded-xl border border-[#dce6ed] bg-white p-1.5 text-left shadow-xl">
                          <button onClick={() => { setDetailRow(row); setMenuRow(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold hover:bg-[#eef7fd]"><Eye size={14}/> View</button>
                          <button onClick={() => { setEditRow(row); setFormOpen(true); setMenuRow(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold hover:bg-[#eef7fd]"><Pencil size={14}/> Edit</button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredRows.length === 0 ? (
              <div className="px-5 py-16 text-center"><Search className="mx-auto text-[#a5b3bc]" /><p className="mt-3 text-sm font-bold text-[#435966]">No records found</p><p className="mt-1 text-xs text-[#81929c]">Try changing your search or filter.</p></div>
            ) : null}
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-[11px] text-[#7b8d97]">Showing {filteredRows.length} of {rows.length} records</p>
            <div className="flex gap-1">
              <button aria-label="Previous page" onClick={() => notify("You are on the first page")} className="grid size-8 place-items-center rounded-lg border border-[#dce6ed] text-[#758995]"><ChevronLeft size={15}/></button>
              <button className="grid size-8 place-items-center rounded-lg bg-[#007DCC] text-xs font-bold text-white">1</button>
              <button aria-label="Next page" onClick={() => notify("No more records in this preview")} className="grid size-8 place-items-center rounded-lg border border-[#dce6ed] text-[#758995]"><ChevronRight size={15}/></button>
            </div>
          </div>
        </Card>
      </div>

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#061625]/45 backdrop-blur-sm">
          <button aria-label="Close form" className="flex-1" onClick={() => { setFormOpen(false); setEditRow(null); }} />
          <div className="h-full w-full max-w-lg overflow-y-auto bg-white p-5 shadow-2xl md:p-7">
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#007DCC]">{config.title}</p><h2 className="mt-1 text-xl font-bold text-[#18313e]">{editRow ? `Edit ${editRow.id}` : config.primaryAction}</h2></div>
              <button aria-label="Close form panel" onClick={() => { setFormOpen(false); setEditRow(null); }} className="rounded-lg p-2 hover:bg-[#f0f5f8]"><X size={19}/></button>
            </div>
            <form onSubmit={submitForm} className="mt-6 space-y-4">
              {config.formFields.map((field, index) => (
                <label key={field} className="block">
                  <span className="mb-1.5 block text-xs font-bold text-[#455c68]">{field}</span>
                  <input
                    name={field}
                    required={index < 2}
                    defaultValue={editRow ? (index === 0 ? editRow.primary : index === 1 ? editRow.secondary : "") : ""}
                    type={field.toLowerCase().includes("date") ? "date" : field.toLowerCase().includes("amount") || field.toLowerCase().includes("price") || field.toLowerCase().includes("budget") ? "number" : "text"}
                    placeholder={`Enter ${field.toLowerCase()}`}
                    className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"
                  />
                </label>
              ))}
              <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-5 text-[#315b74]">
                This frontend preview stores the record for the current session. Backend persistence will replace this local state later.
              </div>
              <div className="flex justify-end gap-2 border-t border-[#e5ecf1] pt-5">
                <button type="button" onClick={() => { setFormOpen(false); setEditRow(null); }} className="h-10 rounded-xl border border-[#dce6ed] px-4 text-xs font-bold text-[#536b78]">Cancel</button>
                <button type="submit" className="h-10 rounded-xl bg-[#007DCC] px-5 text-xs font-bold text-white hover:bg-[#0069ad]">{editRow ? "Save changes" : "Save draft"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailRow ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#061625]/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-bold text-[#007DCC]">{detailRow.id}</p><h2 className="mt-1 text-xl font-bold">{detailRow.primary}</h2></div>
              <button aria-label="Close details" onClick={() => setDetailRow(null)}><X size={19}/></button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              {[["Details",detailRow.secondary],["Value",detailRow.value],["Status",detailRow.status],["Date",detailRow.date]].map(([label,value])=>(
                <div key={label} className="rounded-xl bg-[#f6f9fb] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#8496a0]">{label}</p><p className="mt-1 text-sm font-bold text-[#2f4652]">{value}</p></div>
              ))}
            </div>
            <button onClick={() => setDetailRow(null)} className="mt-5 w-full rounded-xl bg-[#007DCC] py-2.5 text-xs font-bold text-white">Done</button>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[60] rounded-xl bg-[#0d2c40] px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div>
      ) : null}
    </AppShell>
  );
}
