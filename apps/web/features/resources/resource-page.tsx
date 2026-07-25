"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { AppShell } from "../../components/layout/app-shell";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";
import {
  moduleDefinitions,
  type FormField,
  type ResourceConfig,
  type ResourceRow,
} from "./resource-config";

interface LineItem {
  id: number;
  item: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  tax: string;
}

const badgeVariant = (status: string) => {
  if (["Paid", "Posted", "Active", "Approved", "Completed"].includes(status)) return "success";
  if (["Overdue", "Rejected", "Low stock"].includes(status)) return "danger";
  if (["Pending", "Open", "Partially paid"].includes(status)) return "warning";
  return "neutral";
};

function FormControl({ field, defaultValue }: { field: FormField; defaultValue?: string }) {
  const base =
    "h-11 w-full rounded-xl border border-[#dce6ed] bg-white px-3 text-sm text-[#29414d] outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10";

  if (field.type === "textarea") {
    return <textarea name={field.name} defaultValue={defaultValue} required={field.required} placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`} className={cn(base, "min-h-24 resize-y py-3")} />;
  }
  if (field.type === "select") {
    return (
      <select name={field.name} defaultValue={defaultValue} required={field.required} className={base}>
        <option value="">Select {field.label.toLowerCase()}</option>
        {field.options?.map((option) => <option key={option}>{option}</option>)}
      </select>
    );
  }
  if (field.type === "checkbox") {
    return (
      <label className="flex h-11 items-center gap-2 rounded-xl border border-[#dce6ed] px-3 text-xs font-semibold text-[#536a76]">
        <input name={field.name} type="checkbox" defaultChecked={defaultValue === "true"} className="size-4 accent-[#007DCC]" />
        {field.label}
      </label>
    );
  }
  return (
    <input
      name={field.name}
      type={field.type}
      defaultValue={defaultValue}
      required={field.required}
      placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
      className={base}
    />
  );
}

export function ResourcePage({ config }: { config: ResourceConfig }) {
  const searchParams = useSearchParams();
  const moduleDefinition = moduleDefinitions[config.module];
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [status, setStatus] = useState("All statuses");
  const [rows, setRows] = useState(config.rows);
  const [formOpen, setFormOpen] = useState(() => searchParams.has("create"));
  const [detailRow, setDetailRow] = useState<ResourceRow | null>(null);
  const [editRow, setEditRow] = useState<ResourceRow | null>(null);
  const [menuRow, setMenuRow] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: 1, item: "", description: "", quantity: "1", unit: "Each", rate: "", tax: "Standard tax" },
  ]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const text = `${row.id} ${row.cells.join(" ")}`.toLowerCase();
        return text.includes(search.toLowerCase()) && (status === "All statuses" || row.status === status);
      }),
    [rows, search, status],
  );

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  };

  const openNew = () => {
    setEditRow(null);
    setLineItems([{ id: 1, item: "", description: "", quantity: "1", unit: "Each", rate: "", tax: "Standard tax" }]);
    setFormOpen(true);
  };

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const firstFields = config.formSections.flatMap((section) => section.fields).filter((field) => field.type !== "checkbox");
    const primary = String(data.get(firstFields[0]?.name) || `New ${config.title.toLowerCase()} record`);
    const amountField = firstFields.find((field) => /amount|price|balance|budget|value|principal/i.test(field.name));
    const value = amountField ? `$${Number(data.get(amountField.name) || 0).toLocaleString()}` : "—";

    if (editRow) {
      setRows((current) =>
        current.map((row) =>
          row.id === editRow.id ? { ...row, cells: [primary, value, "25 Jul 2026"], status: "Draft" } : row,
        ),
      );
      notify(`${editRow.id} updated`);
    } else {
      const prefix = config.slug.slice(0, 3).toUpperCase();
      setRows((current) => [
        { id: `${prefix}-${String(current.length + 1050).padStart(4, "0")}`, cells: [primary, value, "25 Jul 2026"], status: "Draft" },
        ...current,
      ]);
      notify(`${config.primaryAction} saved as draft`);
    }
    setFormOpen(false);
    setEditRow(null);
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
    notify("CSV export downloaded");
  };

  const lineTotal = lineItems.reduce(
    (total, line) => total + Number(line.quantity || 0) * Number(line.rate || 0),
    0,
  );

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
            <button onClick={exportRows} className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3.5 text-xs font-bold text-[#425966] hover:bg-[#f5f9fc]">
              <Download size={16} /> Export
            </button>
            <button onClick={openNew} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white hover:bg-[#0069ad]">
              <Plus size={17} /> {config.primaryAction}
            </button>
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

          <div className="flex flex-col gap-3 border-b border-[#e5ecf1] p-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8496a1]" size={16} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.searchPlaceholder} className="h-10 w-full rounded-xl border border-[#dce6ed] bg-[#f8fafc] pl-9 pr-3 text-xs outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10" />
            </div>
            <div className="relative">
              <Filter className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#71848f]" size={15} />
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 appearance-none rounded-xl border border-[#dce6ed] bg-white pl-9 pr-8 text-xs font-semibold text-[#526874] outline-none">
                <option>All statuses</option>
                {["Active","Paid","Posted","Pending","Draft","Overdue"].map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <button onClick={() => { setSearch(""); setStatus("All statuses"); notify("Filters reset"); }} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6ed] px-3 text-xs font-semibold text-[#526874]">
              <SlidersHorizontal size={15} /> Reset
            </button>
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
                  <tr key={row.id} className="border-b border-[#edf1f4] hover:bg-[#f8fbfd]">
                    <td className="px-5 py-4 text-xs font-bold text-[#007DCC]">{row.id}</td>
                    {row.cells.slice(0, config.columns.length - 1).map((cell, index) => (
                      <td key={`${row.id}-${index}`} className="px-5 py-4 text-xs font-semibold text-[#334b57]">
                        {index === 0 ? <><p>{cell}</p><p className="mt-1 text-[10px] font-normal text-[#83949e]">Main company · Main branch</p></> : cell}
                      </td>
                    ))}
                    <td className="px-5 py-4"><Badge variant={badgeVariant(row.status)}>{row.status}</Badge></td>
                    <td className="relative px-5 py-4 text-right">
                      <button aria-label={`Actions for ${row.id}`} onClick={() => setMenuRow(menuRow === row.id ? null : row.id)} className="rounded-lg p-2 text-[#78909d] hover:bg-[#e9f4fb] hover:text-[#007DCC]"><MoreHorizontal size={17} /></button>
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

      {formOpen ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#061625]/50 backdrop-blur-sm">
          <button aria-label="Close form" className="flex-1" onClick={() => { setFormOpen(false); setEditRow(null); }} />
          <div className="h-full w-full max-w-5xl overflow-y-auto bg-[#f7fafc] shadow-2xl">
            <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#dfe7ed] bg-white px-5 py-4 md:px-8">
              <div><p className="text-xs font-bold text-[#007DCC]">{config.moduleTitle}</p><h2 className="mt-1 text-xl font-bold text-[#18313e]">{editRow ? `Edit ${editRow.id}` : config.primaryAction}</h2></div>
              <button aria-label="Close form panel" onClick={() => { setFormOpen(false); setEditRow(null); }} className="rounded-lg p-2 hover:bg-[#f0f5f8]"><X size={20}/></button>
            </div>
            <form onSubmit={submit} className="space-y-4 p-4 md:p-8">
              {config.formSections.map((section) => (
                <Card key={section.title} className="p-5">
                  <h3 className="text-sm font-bold text-[#213b48]">{section.title}</h3>
                  {section.description ? <p className="mt-1 text-xs text-[#7b8e99]">{section.description}</p> : null}
                  <div className="mt-5 grid gap-4 md:grid-cols-6">
                    {section.fields.map((field, index) => (
                      <label key={field.name} className={cn("block", field.width === "full" ? "md:col-span-6" : field.width === "third" ? "md:col-span-2" : "md:col-span-3")}>
                        {field.type !== "checkbox" ? <span className="mb-1.5 block text-xs font-bold text-[#455c68]">{field.label}{field.required ? <span className="ml-1 text-red-500">*</span> : null}</span> : null}
                        <FormControl field={field} defaultValue={editRow ? (index === 0 ? editRow.cells[0] : "") : undefined} />
                      </label>
                    ))}
                  </div>
                </Card>
              ))}

              {config.hasLineItems ? (
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between border-b border-[#e5ecf1] p-5">
                    <div><h3 className="text-sm font-bold text-[#213b48]">Items, quantities & pricing</h3><p className="mt-1 text-xs text-[#7b8e99]">Add every product, service, account, class, tax, lot, or serial line required.</p></div>
                    <button type="button" onClick={() => setLineItems((current) => [...current, { id: Date.now(), item: "", description: "", quantity: "1", unit: "Each", rate: "", tax: "Standard tax" }])} className="flex items-center gap-1.5 rounded-lg bg-[#eaf5fc] px-3 py-2 text-xs font-bold text-[#007DCC]"><Plus size={14}/> Add line</button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px]">
                      <thead><tr className="bg-[#f8fafc]">{["Item/account","Description","Qty","U/M","Rate","Tax","Amount",""].map((heading) => <th key={heading} className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#768994]">{heading}</th>)}</tr></thead>
                      <tbody>
                        {lineItems.map((line) => {
                          const update = (key: keyof LineItem, value: string) => setLineItems((current) => current.map((item) => item.id === line.id ? { ...item, [key]: value } : item));
                          return (
                            <tr key={line.id} className="border-t border-[#edf1f4]">
                              <td className="p-2"><input value={line.item} onChange={(event) => update("item", event.target.value)} placeholder="Select item" className="h-10 w-full rounded-lg border border-[#dce6ed] px-2 text-xs"/></td>
                              <td className="p-2"><input value={line.description} onChange={(event) => update("description", event.target.value)} placeholder="Description" className="h-10 w-full rounded-lg border border-[#dce6ed] px-2 text-xs"/></td>
                              <td className="p-2"><input type="number" value={line.quantity} onChange={(event) => update("quantity", event.target.value)} className="h-10 w-20 rounded-lg border border-[#dce6ed] px-2 text-xs"/></td>
                              <td className="p-2"><select value={line.unit} onChange={(event) => update("unit", event.target.value)} className="h-10 rounded-lg border border-[#dce6ed] px-2 text-xs"><option>Each</option><option>Box</option><option>Kg</option><option>Hour</option></select></td>
                              <td className="p-2"><input type="number" value={line.rate} onChange={(event) => update("rate", event.target.value)} className="h-10 w-24 rounded-lg border border-[#dce6ed] px-2 text-xs"/></td>
                              <td className="p-2"><select value={line.tax} onChange={(event) => update("tax", event.target.value)} className="h-10 rounded-lg border border-[#dce6ed] px-2 text-xs"><option>Standard tax</option><option>Non-taxable</option><option>Zero rated</option></select></td>
                              <td className="p-2 text-xs font-bold text-[#29414d]">${(Number(line.quantity || 0) * Number(line.rate || 0)).toLocaleString()}</td>
                              <td className="p-2"><button type="button" aria-label="Delete line" disabled={lineItems.length === 1} onClick={() => setLineItems((current) => current.filter((item) => item.id !== line.id))} className="rounded-lg p-2 text-red-500 disabled:opacity-30"><Trash2 size={15}/></button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end border-t border-[#e5ecf1] p-5">
                    <div className="w-72 space-y-2 text-xs">
                      <div className="flex justify-between text-[#647984]"><span>Subtotal</span><span>${lineTotal.toLocaleString()}</span></div>
                      <div className="flex justify-between text-[#647984]"><span>Estimated tax</span><span>${(lineTotal * 0.05).toLocaleString()}</span></div>
                      <div className="flex justify-between border-t border-[#dfe7ed] pt-2 text-base font-bold text-[#17303d]"><span>Total</span><span>${(lineTotal * 1.05).toLocaleString()}</span></div>
                    </div>
                  </div>
                </Card>
              ) : null}

              <div className="sticky bottom-0 flex justify-end gap-2 rounded-2xl border border-[#dfe7ed] bg-white p-4 shadow-lg">
                <button type="button" onClick={() => { setFormOpen(false); setEditRow(null); }} className="h-10 rounded-xl border border-[#dce6ed] px-4 text-xs font-bold text-[#536b78]">Cancel</button>
                <button type="button" onClick={() => notify("Draft saved locally")} className="h-10 rounded-xl border border-[#007DCC] px-4 text-xs font-bold text-[#007DCC]">Save draft</button>
                <button type="submit" className="h-10 rounded-xl bg-[#007DCC] px-5 text-xs font-bold text-white hover:bg-[#0069ad]">{editRow ? "Save changes" : "Save & close"}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailRow ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#061625]/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex justify-between"><div><p className="text-xs font-bold text-[#007DCC]">{detailRow.id}</p><h2 className="mt-1 text-xl font-bold">{detailRow.cells[0]}</h2></div><button aria-label="Close details" onClick={() => setDetailRow(null)}><X size={19}/></button></div>
            <div className="mt-5 grid grid-cols-2 gap-3">{detailRow.cells.map((cell,index)=><div key={`${cell}-${index}`} className="rounded-xl bg-[#f6f9fb] p-3"><p className="text-[10px] font-bold uppercase text-[#8496a0]">{config.columns[index+1] ?? "Detail"}</p><p className="mt-1 text-sm font-bold">{cell}</p></div>)}</div>
            <button onClick={() => setDetailRow(null)} className="mt-5 w-full rounded-xl bg-[#007DCC] py-2.5 text-xs font-bold text-white">Done</button>
          </div>
        </div>
      ) : null}

      {toast ? <div className="fixed bottom-5 right-5 z-[60] rounded-xl bg-[#0d2c40] px-4 py-3 text-xs font-semibold text-white shadow-xl">{toast}</div> : null}
    </AppShell>
  );
}
