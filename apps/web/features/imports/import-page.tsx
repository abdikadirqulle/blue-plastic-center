"use client";

import { useRef, useState } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  Package,
  Receipt,
  UploadCloud,
  Users,
  WalletCards,
} from "lucide-react";
import { AppShell } from "../../components/layout/app-shell";
import { Card } from "../../components/ui/card";
import { cn } from "../../lib/utils";

const importModules = [
  { name: "Customers", description: "Names, contacts, addresses, terms and opening balances", icon: Users },
  { name: "Vendors", description: "Supplier contacts, payment terms and opening balances", icon: Building2 },
  { name: "Items & services", description: "SKUs, prices, costs, tax, quantities and warehouses", icon: Package },
  { name: "Chart of accounts", description: "Accounts, types, currencies and opening balances", icon: WalletCards },
  { name: "Sales transactions", description: "Invoices, estimates, payments and credit notes", icon: Receipt },
  { name: "Purchase transactions", description: "Bills, purchase orders, expenses and payments", icon: FileSpreadsheet },
];

export function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState("Customers");
  const [file, setFile] = useState("");
  const [step, setStep] = useState(1);

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px]">
        <div>
          <p className="mb-2 text-xs font-bold text-[#007DCC]">Data management</p>
          <h1 className="text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">Import data</h1>
          <p className="mt-1.5 text-sm text-[#6b7e8a]">Move existing company data into Al-Furat using CSV or Excel templates.</p>
        </div>

        <div className="mt-6 flex items-center gap-2">
          {["Choose module","Upload file","Map columns","Review & import"].map((label,index) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-[11px] font-bold", index + 1 <= step ? "bg-[#007DCC] text-white" : "bg-[#e4ebef] text-[#71838e]")}>{index + 1}</span>
              <span className="hidden text-xs font-bold text-[#526874] md:block">{label}</span>
              {index < 3 ? <span className="h-px flex-1 bg-[#dce6ed]"/> : null}
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.7fr)]">
          <Card className="p-5 md:p-6">
            <h2 className="text-sm font-bold text-[#253e4a]">1. Choose what you want to import</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {importModules.map(({ name, description, icon: Icon }) => (
                <button key={name} onClick={() => { setSelected(name); setStep(1); setFile(""); }} className={cn("flex items-start gap-3 rounded-xl border p-4 text-left", selected === name ? "border-[#007DCC] bg-[#eef8fe] ring-2 ring-[#007DCC]/10" : "border-[#dfe7ed] hover:border-sky-200")}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#007DCC] shadow-sm"><Icon size={18}/></span>
                  <span><span className="block text-xs font-bold text-[#29424e]">{name}</span><span className="mt-1 block text-[11px] leading-5 text-[#788b96]">{description}</span></span>
                  {selected === name ? <CheckCircle2 size={17} className="ml-auto shrink-0 text-[#007DCC]"/> : null}
                </button>
              ))}
            </div>

            <div className="mt-6 border-t border-[#e8eef2] pt-5">
              <div className="flex items-center justify-between"><div><h2 className="text-sm font-bold text-[#253e4a]">2. Upload {selected.toLowerCase()}</h2><p className="mt-1 text-xs text-[#7c8e98]">Accepted formats: .xlsx, .xls and .csv up to 20 MB.</p></div><button onClick={() => setFile(`${selected.toLowerCase().replaceAll(" ","-")}-template.csv`)} className="text-xs font-bold text-[#007DCC]">Download template</button></div>
              <input ref={inputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(event) => { const next = event.target.files?.[0]?.name; if (next) { setFile(next); setStep(2); } }}/>
              <button onClick={() => inputRef.current?.click()} className="mt-4 flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cfdce4] bg-[#f8fafc] p-6 hover:border-[#007DCC] hover:bg-[#f2f9fd]">
                <span className="grid size-12 place-items-center rounded-2xl bg-[#e4f3fc] text-[#007DCC]"><UploadCloud size={23}/></span>
                <span className="mt-3 text-sm font-bold text-[#2d4652]">{file || "Choose a file or drag it here"}</span>
                <span className="mt-1 text-xs text-[#80929d]">{file ? "File ready for column mapping" : "Your source file is processed locally in this preview"}</span>
              </button>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-sm font-bold text-[#253e4a]">Import checklist</h2>
              <div className="mt-4 space-y-3">
                {["Use one header row","Keep required columns populated","Use ISO dates: YYYY-MM-DD","Use unique reference numbers","Review duplicate matching"].map((item)=><div key={item} className="flex items-center gap-2 text-xs font-semibold text-[#526874]"><CheckCircle2 size={15} className="text-emerald-500"/>{item}</div>)}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-bold text-[#253e4a]">Selected module</h2>
              <p className="mt-2 text-lg font-bold text-[#007DCC]">{selected}</p>
              <p className="mt-2 text-xs leading-5 text-[#788b96]">The next step maps your spreadsheet columns to Al-Furat fields and validates every row before import.</p>
              <button disabled={!file} onClick={() => setStep((current) => Math.min(4, current + 1))} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#007DCC] text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Continue <ArrowRight size={15}/></button>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
