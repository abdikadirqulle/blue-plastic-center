import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import {
  endOfMonth,
  endOfQuarter,
  endOfYear,
  format,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  subMonths,
  subYears,
} from "date-fns"
import {
  ArrowLeft,
  FileDown,
  FileSpreadsheet,
  LoaderCircle,
  Printer,
  RefreshCw,
} from "lucide-react"
import { Link } from "@/components/routing"
import { AppShell } from "../../components/layout/app-shell"
import { Card } from "../../components/ui/card"
import { DatePicker } from "../../components/ui/date-picker"
import { Select } from "../../components/ui/select"
import { Toast, type ToastMessage } from "../../components/ui/toast"
import { apiClient } from "../../lib/api-client"
import { formatDecimal } from "../../lib/utils"
import { FinancialReportTable } from "./financial-report-table"
import {
  buildFinancialLines,
  type FinancialLine,
  type TrialBalanceRow,
} from "./financial-report-model"
import {
  exportReportExcel,
  exportReportPdf,
  printReportPdf,
} from "./report-export"
import { isReportKind } from "./report-registry"

interface ReportResult {
  reportId: string
  kind: string
  generatedAt: string
  rows: Array<Record<string, unknown>>
  controlTotals?: { debit: string; credit: string; balanced: boolean }
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
  item: "Item",
  quantitySold: "Quantity sold",
  salesAmount: "Sales amount",
  invoiceCount: "Invoices",
  totalSales: "Total sales",
  balanceDue: "Balance due",
  invoice: "Invoice",
  document: "Document",
  payment: "Payment",
  method: "Payment method",
  appliedTo: "Applied to",
  activity: "Activity",
}

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—"
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value === "object") return "—"
  if (typeof value === "number") return formatDecimal(value)
  if (typeof value === "string" && /^-?\d+\.\d+$/.test(value))
    return formatDecimal(value)
  return String(value)
}

export function ReportViewerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const name = searchParams.get("name") ?? "Financial report"
  const kind = searchParams.get("kind") ?? ""
  const [from, setFrom] = useState(
    searchParams.get("from") ?? format(startOfMonth(new Date()), "yyyy-MM-dd"),
  )
  const [to, setTo] = useState(
    searchParams.get("to") ?? format(new Date(), "yyyy-MM-dd"),
  )
  const [basis, setBasis] = useState(searchParams.get("basis") ?? "accrual")
  const [parameters, setParameters] = useState({ from, to, basis })
  const [result, setResult] = useState<ReportResult | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState("Custom")
  const [exporting, setExporting] = useState<"pdf" | "excel" | "print" | null>(
    null,
  )
  const [message, setMessage] = useState<ToastMessage | null>(null)

  useEffect(() => {
    if (!isReportKind(kind)) {
      setResult(null)
      setLoading(false)
      setError(
        "This report has no registered read model. Return to All reports and choose an available report.",
      )
      return
    }
    let active = true
    setLoading(true)
    setError("")
    void apiClient
      .action<ReportResult>(`/v1/reports/${kind}/run`, {
        ...parameters,
        currency: "USD",
      })
      .then((response) => {
        if (active) setResult(response.data)
      })
      .catch((caught) => {
        if (active)
          setError(
            caught instanceof Error
              ? caught.message
              : "Unable to run this report.",
          )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [kind, parameters])

  const columns = useMemo(() => {
    const keys = new Set<string>()
    result?.rows.forEach((row) =>
      Object.keys(row).forEach((key) => {
        const value = row[key]
        if (
          !/id$/i.test(key) &&
          !["changes", "isDeleted", "deletedAt"].includes(key) &&
          (typeof value !== "object" || value === null)
        )
          keys.add(key)
      }),
    )
    return [...keys].slice(0, 9)
  }, [result])

  const updateParameters = () => {
    setSearchParams({ name, kind, from, to, basis })
    setParameters({ from, to, basis })
  }

  const choosePeriod = (value: string) => {
    setPeriod(value)
    const today = new Date()
    const presets: Record<string, [Date, Date]> = {
      All: [new Date("2000-01-01T00:00:00"), today],
      Today: [today, today],
      "This month": [startOfMonth(today), today],
      "Last month": [
        startOfMonth(subMonths(today, 1)),
        endOfMonth(subMonths(today, 1)),
      ],
      "This quarter": [startOfQuarter(today), today],
      "Last quarter": [
        startOfQuarter(subMonths(today, 3)),
        endOfQuarter(subMonths(today, 3)),
      ],
      "This year": [startOfYear(today), today],
      "Last year": [
        startOfYear(subYears(today, 1)),
        endOfYear(subYears(today, 1)),
      ],
    }
    const range = presets[value]
    if (range) {
      setFrom(format(range[0], "yyyy-MM-dd"))
      setTo(format(range[1], "yyyy-MM-dd"))
    }
  }

  const financialLines = useMemo(
    () =>
      result
        ? buildFinancialLines(kind, result.rows as TrialBalanceRow[])
        : null,
    [kind, result],
  )
  const exportLines = useMemo<FinancialLine[]>(() => {
    if (financialLines) return financialLines
    return (result?.rows ?? []).map((row, index) => {
      const label =
        row.accountName ??
        row.customer ??
        row.vendor ??
        row.documentNumber ??
        row.name ??
        row.description ??
        row.id ??
        `Row ${index + 1}`
      const amountKey = Object.keys(row).find(
        (key) =>
          /total|amount|balance|value|debit|credit/i.test(key) &&
          Number.isFinite(Number(row[key])),
      )
      return {
        label: String(label),
        amount: amountKey ? Number(row[amountKey]) : undefined,
        level: 0,
        style: "account",
      }
    })
  }, [financialLines, result])
  const exportData = result
    ? {
        company: "BLUE PLASTIC CENTER",
        title: name,
        period:
          kind === "balance-sheet"
            ? `As of ${parameters.to}`
            : `${parameters.from} through ${parameters.to}`,
        basis: parameters.basis === "cash" ? "Cash" : "Accrual",
        lines: exportLines,
      }
    : null

  const runExport = async (type: "pdf" | "excel" | "print") => {
    if (!exportData || exporting) return
    setExporting(type)
    try {
      if (type === "pdf") await exportReportPdf(exportData)
      if (type === "excel") exportReportExcel(exportData)
      if (type === "print") {
        const printWindow = window.open("", "_blank")
        await printReportPdf(exportData, printWindow)
      }
      //   setMessage({
      //     title: type === "print" ? "Print view opened" : `${type.toUpperCase()} ready`,
      //     description: type === "print" ? "The formatted report is ready to print." : `${name} was generated successfully.`,
      //     variant: "success",
      //   });
    } catch (caught) {
      setMessage({
        title: `Unable to generate ${type.toUpperCase()}`,
        description:
          caught instanceof Error
            ? caught.message
            : "The export could not be generated. Please try again.",
        variant: "error",
      })
    } finally {
      setExporting(null)
    }
  }

  return (
    <AppShell>
      <Toast message={message} onClose={() => setMessage(null)} />
      <div className="mx-auto max-w-[1320px]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <Link
            href="/reports/financial"
            className="inline-flex items-center gap-2 text-xs font-medium text-[#526a76]"
          >
            <ArrowLeft size={15} /> All reports
          </Link>
          <div className="flex flex-wrap items-end justify-end gap-2">
            <label className="w-36 text-[10px] font-medium text-[#607681]">
              <span className="mb-1 block">Report period</span>
              <Select
                value={period}
                onValueChange={choosePeriod}
                options={[
                  "All",
                  "Today",
                  "This month",
                  "Last month",
                  "This quarter",
                  "Last quarter",
                  "This year",
                  "Last year",
                  "Custom",
                ]}
                className="h-9"
              />
            </label>
            <label className="w-36 text-[10px] font-medium text-[#607681]">
              <span className="mb-1 block">From</span>
              <DatePicker
                value={from}
                onChange={(value) => {
                  setFrom(value)
                  setPeriod("Custom")
                }}
                className="h-9"
              />
            </label>
            <label className="w-36 text-[10px] font-medium text-[#607681]">
              <span className="mb-1 block">To</span>
              <DatePicker
                value={to}
                onChange={(value) => {
                  setTo(value)
                  setPeriod("Custom")
                }}
                className="h-9"
              />
            </label>
            <label className="w-32 text-[10px] font-medium text-[#607681]">
              <span className="mb-1 block">Accounting method</span>
              <Select
                value={basis}
                onValueChange={setBasis}
                options={[
                  { label: "Accrual", value: "accrual" },
                  { label: "Cash", value: "cash" },
                ]}
                className="h-9"
              />
            </label>
            <button
              onClick={updateParameters}
              disabled={loading}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#007DCC] px-3 text-xs font-medium text-white disabled:opacity-60"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />{" "}
              Run report
            </button>
            <span className="mx-1 h-8 w-px bg-[#dbe4e9]" />
            <button
              onClick={() => void runExport("pdf")}
              disabled={!exportData || loading || Boolean(exporting)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d9e3e9] bg-white px-3 text-xs font-medium disabled:opacity-40"
            >
              {exporting === "pdf" ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <FileDown size={14} />
              )}{" "}
              PDF
            </button>
            <button
              onClick={() => void runExport("excel")}
              disabled={!exportData || loading || Boolean(exporting)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d9e3e9] bg-white px-3 text-xs font-medium disabled:opacity-40"
            >
              {exporting === "excel" ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <FileSpreadsheet size={14} />
              )}{" "}
              Excel
            </button>
            <button
              onClick={() => void runExport("print")}
              disabled={!exportData || loading || Boolean(exporting)}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d9e3e9] bg-white px-3 text-xs font-medium disabled:opacity-40"
            >
              {exporting === "print" ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Printer size={14} />
              )}{" "}
              Print
            </button>
          </div>
        </div>

        <Card className="overflow-hidden rounded-xl">
          <div className="border-b border-[#e4eaee] px-6 py-5 text-center">
            <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#71838d]">
              BLUE PLASTIC CENTER
            </p>
            <h1 className="mt-1 text-xl font-semibold text-[#18313e]">
              {name}
            </h1>
            <p className="mt-1 text-xs text-[#71838d]">
              {kind === "balance-sheet"
                ? `As of ${parameters.to}`
                : `${parameters.from} through ${parameters.to}`}{" "}
              · {parameters.basis === "cash" ? "Cash" : "Accrual"} basis
            </p>
          </div>

          {loading ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center gap-3">
              <span className="grid size-12 place-items-center rounded-full bg-[#eaf5fc] text-[#007DCC]">
                <LoaderCircle size={24} className="animate-spin" />
              </span>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#29434f]">
                  Generating {name}
                </p>
                <p className="mt-1 text-xs text-[#7b8d97]">
                  Preparing accounts and calculating report totals…
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="m-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : financialLines ? (
            financialLines.some((line) => line.style === "account") ? (
              <FinancialReportTable lines={financialLines} />
            ) : (
              <div className="px-6 py-16 text-center text-sm text-[#71838d]">
                No posted transactions were found for this report period.
              </div>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b-2 border-[#7d8e97] bg-[#f7f9fa]">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        className="px-4 py-2.5 font-semibold text-[#405762]"
                      >
                        {labels[column] ?? column.replace(/([A-Z])/g, " $1")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result?.rows.length ? (
                    result.rows.map((row, index) => (
                      <tr
                        key={String(row.id ?? index)}
                        className="border-b border-[#e8edef]"
                      >
                        {columns.map((column) => (
                          <td
                            key={column}
                            className={`px-4 py-2.5 text-[#344d59] ${/debit|credit|amount|balance|value|total/i.test(column) ? "text-right tabular-nums" : ""}`}
                          >
                            {display(row[column])}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={Math.max(columns.length, 1)}
                        className="px-6 py-16 text-center text-[#71838d]"
                      >
                        No transactions found for this report period.
                      </td>
                    </tr>
                  )}
                </tbody>
                {result?.controlTotals ? (
                  <tfoot className="border-t-2 border-[#7d8e97] bg-[#f7f9fa]">
                    <tr>
                      {columns.map((column, index) => (
                        <td
                          key={column}
                          className="px-4 py-3 text-right font-semibold tabular-nums"
                        >
                          {index === 0
                            ? "TOTAL"
                            : column === "debit"
                              ? result.controlTotals?.debit
                              : column === "credit"
                                ? result.controlTotals?.credit
                                : ""}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )}
          <div className="flex flex-wrap justify-between gap-2 border-t border-[#e4eaee] px-5 py-3 text-[10px] text-[#80919a]">
            <span>
              Generated by:{" "}
              <strong className="font-semibold text-[#536a76]">
                BLUE PLASTIC CENTER
              </strong>
            </span>
            <span>
              {result
                ? `Generated ${new Date(result.generatedAt).toLocaleString()} · ${result.rows.length} source rows`
                : ""}
            </span>
          </div>
        </Card>
      </div>
    </AppShell>
  )
}
