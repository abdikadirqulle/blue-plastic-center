"use client"

import { useRef, useState } from "react"
import { CheckCircle2, Download, FileSpreadsheet, UploadCloud } from "lucide-react"
import { AppShell } from "../../components/layout/app-shell"
import { Card } from "../../components/ui/card"
import { Toast, type ToastMessage } from "../../components/ui/toast"
import { apiClient } from "../../lib/api-client"
import { cn } from "../../lib/utils"

type ImportResult = {
  totalRows: number
  validRows: number
  invalidRows: number
  importedRows: number
  errors: Array<{ row: number; message: string }>
}

const importModules = [
  { name: "Customers", module: "sales", resource: "customers", headers: ["displayName", "email", "phone", "currency"] },
  { name: "Vendors", module: "purchasing", resource: "vendors", headers: ["displayName", "email", "phone", "currency"] },
  { name: "Items & services", module: "inventory", resource: "items", headers: ["name", "sku", "type", "salesPrice", "purchaseCost"] },
  { name: "Chart of accounts", module: "accounting", resource: "chart-of-accounts", headers: ["accountNumber", "name", "type", "currency"] },
  { name: "Sales transactions", module: "sales", resource: "invoices", headers: ["customer", "invoiceDate", "dueDate", "currency", "total"] },
  { name: "Purchase transactions", module: "purchasing", resource: "bills", headers: ["vendor", "billDate", "dueDate", "currency", "total"] },
] as const

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let value = ""
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"'
        index += 1
      } else quoted = !quoted
    } else if (character === "," && !quoted) {
      row.push(value.trim())
      value = ""
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1
      row.push(value.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      value = ""
    } else value += character
  }
  row.push(value.trim())
  if (row.some(Boolean)) rows.push(row)
  const [headers = [], ...values] = rows
  return values.map((cells) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), cells[index] ?? ""])),
  )
}

export function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState(0)
  const [fileName, setFileName] = useState("")
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [result, setResult] = useState<ImportResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const definition = importModules[selected]

  const downloadTemplate = () => {
    const blob = new Blob([`${definition.headers.join(",")}\n`], { type: "text/csv" })
    const anchor = document.createElement("a")
    anchor.href = URL.createObjectURL(blob)
    anchor.download = `${definition.resource}-template.csv`
    anchor.click()
    URL.revokeObjectURL(anchor.href)
  }

  const processFile = async (file?: File) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setToast({ title: "Unsupported file", description: "Please upload a CSV file.", variant: "error" })
      return
    }
    const parsed = parseCsv(await file.text())
    setFileName(file.name)
    setRows(parsed)
    setResult(null)
  }

  const submit = async (dryRun: boolean) => {
    setLoading(true)
    try {
      const response = await apiClient.action<ImportResult>("/v1/imports", {
        module: definition.module,
        resource: definition.resource,
        rows,
        dryRun,
      })
      setResult(response.data)
      setToast({
        title: dryRun ? "Validation completed" : "Import completed",
        description: `${response.data.validRows} valid, ${response.data.invalidRows} invalid, ${response.data.importedRows} imported.`,
        variant: response.data.invalidRows ? "warning" : "success",
      })
    } catch (error) {
      setToast({ title: "Import failed", description: error instanceof Error ? error.message : "Unable to import file.", variant: "error" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-[1200px]">
        <p className="text-xs font-bold text-[#007DCC]">Data management</p>
        <h1 className="mt-2 text-3xl font-bold text-[#142735]">Import database records</h1>
        <p className="mt-2 text-sm text-[#6b7e8a]">Validate a CSV, review row errors, then save valid records directly to PostgreSQL.</p>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="p-6">
            <h2 className="text-sm font-bold text-[#253e4a]">1. Select a destination</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {importModules.map((item, index) => (
                <button key={item.name} onClick={() => { setSelected(index); setRows([]); setFileName(""); setResult(null) }} className={cn("rounded-xl border p-4 text-left", selected === index ? "border-[#007DCC] bg-[#eef8fe]" : "border-[#dfe7ed]")}>
                  <span className="flex items-center gap-2 text-xs font-bold text-[#29424e]"><FileSpreadsheet size={16} className="text-[#007DCC]"/>{item.name}</span>
                  <span className="mt-2 block text-[11px] text-[#788b96]">{item.module}/{item.resource}</span>
                </button>
              ))}
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-[#e8eef2] pt-5">
              <div><h2 className="text-sm font-bold text-[#253e4a]">2. Upload CSV</h2><p className="mt-1 text-xs text-[#7c8e98]">{definition.headers.join(", ")}</p></div>
              <button onClick={downloadTemplate} className="flex items-center gap-2 text-xs font-bold text-[#007DCC]"><Download size={15}/>Template</button>
            </div>
            <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => void processFile(event.target.files?.[0])}/>
            <button onClick={() => inputRef.current?.click()} className="mt-4 flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cfdce4] bg-[#f8fafc] p-6 hover:border-[#007DCC]">
              <UploadCloud size={24} className="text-[#007DCC]"/>
              <span className="mt-3 text-sm font-bold text-[#2d4652]">{fileName || "Choose a CSV file"}</span>
              <span className="mt-1 text-xs text-[#80929d]">{rows.length ? `${rows.length} data rows parsed` : "Files are parsed locally before validation"}</span>
            </button>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-sm font-bold text-[#253e4a]">Review & import</h2>
              {result ? <div className="mt-4 space-y-2 text-xs text-[#526874]">
                <p className="flex items-center gap-2 font-bold"><CheckCircle2 size={15} className="text-emerald-500"/>{result.validRows} valid rows</p>
                <p>{result.invalidRows} invalid rows · {result.importedRows} saved</p>
                {result.errors.slice(0, 8).map((error) => <p key={`${error.row}-${error.message}`} className="rounded-lg bg-red-50 p-2 text-red-700">Row {error.row}: {error.message}</p>)}
              </div> : <p className="mt-3 text-xs leading-5 text-[#788b96]">Validation uses the same Zod and business rules as normal API creation.</p>}
              <button disabled={!rows.length || loading} onClick={() => void submit(true)} className="mt-5 h-11 w-full rounded-xl border border-[#007DCC] text-xs font-bold text-[#007DCC] disabled:opacity-40">{loading ? "Processing…" : "Validate file"}</button>
              <button disabled={!rows.length || loading || !result || result.invalidRows > 0} onClick={() => void submit(false)} className="mt-2 h-11 w-full rounded-xl bg-[#007DCC] text-xs font-bold text-white disabled:opacity-40">Import valid rows</button>
            </Card>
          </div>
        </div>
        <Toast message={toast} onClose={() => setToast(null)}/>
      </div>
    </AppShell>
  )
}
