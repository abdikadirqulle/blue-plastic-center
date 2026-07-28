"use client"

import { useMemo, useState } from "react"
import { format, startOfMonth } from "date-fns"
import { Link } from "@/components/routing"
import { ArrowRight, Box, BriefcaseBusiness, FileText, Landmark, Receipt, Users } from "lucide-react"
import { AppShell } from "../../../components/layout/app-shell"
import { Badge } from "../../../components/ui/badge"
import { Card } from "../../../components/ui/card"
import { DatePicker } from "../../../components/ui/date-picker"
import { Skeleton, ValueSkeleton } from "../../../components/ui/skeleton"
import { formatCurrency } from "../../../lib/utils"
import { useResourceList } from "../../resources/resource-api"

const sources = [
  { module: "sales", resource: "invoices", title: "Sales", href: "/sales/invoices", icon: FileText },
  { module: "purchasing", resource: "bills", title: "Expenses", href: "/purchasing/bills", icon: Receipt },
  { module: "banking", resource: "transactions", title: "Banking", href: "/banking/transactions", icon: Landmark },
  { module: "inventory", resource: "items", title: "Inventory", href: "/inventory/items", icon: Box },
  { module: "projects", resource: "projects", title: "Projects", href: "/projects/projects", icon: BriefcaseBusiness },
  { module: "payroll", resource: "employees", title: "Employees", href: "/payroll/employees", icon: Users },
] as const

function amount(data: Record<string, unknown>) {
  for (const key of ["total", "amount", "balance", "currentBalance", "salesPrice", "budget"]) {
    const value = Number(data[key])
    if (Number.isFinite(value)) return value
  }
  return 0
}

function recordDate(data: Record<string, unknown>, fallback: string) {
  for (const key of ["invoiceDate", "billDate", "transactionDate", "date", "createdAt"])
    if (data[key]) return String(data[key]).slice(0, 10)
  return fallback.slice(0, 10)
}

function recordTitle(data: Record<string, unknown>) {
  for (const key of ["documentNumber", "displayName", "name", "description", "reference", "sku"])
    if (data[key]) return String(data[key])
  return "Database record"
}

function MiniBars({ values, color = "#007DCC" }: { values: number[]; color?: string }) {
  const max = Math.max(...values, 1)
  return <div className="flex h-28 items-end gap-2">{values.map((value, index) => <div key={index} className="flex-1 rounded-t-sm" style={{ height: `${Math.max((value / max) * 100, 3)}%`, background: color, opacity: 0.35 + index * 0.1 }}/>)}</div>
}

export function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd")
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"))
  const [to, setTo] = useState(today)
  const invoices = useResourceList("sales", "invoices", { page: 1, pageSize: 100 })
  const bills = useResourceList("purchasing", "bills", { page: 1, pageSize: 100 })
  const banking = useResourceList("banking", "transactions", { page: 1, pageSize: 100 })
  const inventory = useResourceList("inventory", "items", { page: 1, pageSize: 100 })
  const projects = useResourceList("projects", "projects", { page: 1, pageSize: 100 })
  const employees = useResourceList("payroll", "employees", { page: 1, pageSize: 100 })
  const queries = [invoices, bills, banking, inventory, projects, employees]

  const modules = useMemo(() => sources.map((source, index) => {
    const records = (queries[index].data?.data ?? []).filter((record) => {
      const date = recordDate(record.data, record.createdAt)
      return date >= from && date <= to
    })
    return {
      ...source,
      records,
      total: records.length,
      value: records.reduce((sum, record) => sum + amount(record.data), 0),
      loading: queries[index].isLoading,
    }
  }), [from, to, ...queries.map((query) => query.data)])

  const recent = modules
    .flatMap((source) => source.records.map((record) => ({ ...record, href: source.href })))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 7)
  const anyLoading = queries.some((query) => query.isLoading)
  const monthBuckets = (records: typeof modules[0]["records"]) => Array.from({ length: 6 }, (_, offset) => {
    const date = new Date()
    date.setMonth(date.getMonth() - (5 - offset))
    const key = date.toISOString().slice(0, 7)
    return records.filter((record) => recordDate(record.data, record.createdAt).startsWith(key)).reduce((sum, record) => sum + amount(record.data), 0)
  })

  const summary = [
    { label: "Total sales", value: modules[0].value, helper: `${modules[0].total} invoices`, loading: invoices.isLoading },
    { label: "Total expenses", value: modules[1].value, helper: `${modules[1].total} bills`, loading: bills.isLoading },
    { label: "Net income", value: modules[0].value - modules[1].value, helper: "Sales less expenses", loading: invoices.isLoading || bills.isLoading },
    { label: "Cash activity", value: modules[2].value, helper: `${modules[2].total} transactions`, loading: banking.isLoading },
  ]

  return <AppShell>
    <div className="mx-auto max-w-[1400px]">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div><p className="text-xs font-medium text-[#007DCC]">Company overview</p><h1 className="mt-1 text-2xl font-semibold text-[#142735]">Dashboard</h1><p className="mt-1 text-sm text-[#6b7e8a]">A live view of sales, expenses, cash, and operations.</p></div>
        <div className="flex flex-wrap items-end gap-2"><label className="w-40 text-[11px] text-[#687d88]"><span className="mb-1 block">From</span><DatePicker value={from} onChange={setFrom} className="h-9"/></label><label className="w-40 text-[11px] text-[#687d88]"><span className="mb-1 block">To</span><DatePicker value={to} onChange={setTo} className="h-9"/></label><Link href="/reports/financial" className="flex h-9 items-center gap-2 rounded-lg border bg-white px-3 text-xs font-medium text-[#007DCC]">Reports <ArrowRight size={14}/></Link></div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((stat) => <Card key={stat.label} className="rounded-xl p-4"><p className="text-xs text-[#6d808c]">{stat.label}</p>{stat.loading ? <ValueSkeleton className="mt-2 h-6"/> : <p className="mt-2 text-xl font-semibold tabular-nums text-[#152936]">{formatCurrency(stat.value)}</p>}<p className="mt-1 text-[11px] text-[#718791]">{stat.loading ? "\u00a0" : stat.helper}</p></Card>)}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.35fr_1fr_1fr]">
        <Card className="rounded-xl p-5"><h2 className="text-sm font-semibold text-[#233d49]">Income and expenses</h2><p className="mt-1 text-[11px] text-[#7a8e98]">Last six months</p>{invoices.isLoading || bills.isLoading ? <Skeleton className="mt-5 h-28 w-full"/> : <div className="mt-5 grid grid-cols-2 gap-3"><MiniBars values={monthBuckets(modules[0].records)}/><MiniBars values={monthBuckets(modules[1].records)} color="#f59e0b"/></div>}</Card>
        <Card className="rounded-xl p-5"><h2 className="text-sm font-semibold text-[#233d49]">Invoice status</h2><p className="mt-1 text-[11px] text-[#7a8e98]">Receivables health</p>{invoices.isLoading ? <div className="mt-5 space-y-4">{Array.from({length: 3}, (_, index) => <div key={index}><Skeleton className="mb-2 h-3 w-20"/><Skeleton className="h-1.5 w-full"/></div>)}</div> : <div className="mt-5 space-y-3">{["paid", "open", "overdue"].map((status) => { const count = modules[0].records.filter((record) => record.status.toLowerCase().includes(status)).length; const percent = modules[0].total ? count / modules[0].total * 100 : 0; return <div key={status}><div className="mb-1 flex justify-between text-[11px]"><span className="capitalize text-[#526974]">{status}</span><span>{count}</span></div><div className="h-1.5 rounded-full bg-[#edf2f5]"><div className="h-full rounded-full bg-[#007DCC]" style={{width: `${percent}%`}}/></div></div>})}</div>}</Card>
        <Card className="rounded-xl p-5"><h2 className="text-sm font-semibold text-[#233d49]">Cash position</h2><p className="mt-1 text-[11px] text-[#7a8e98]">Recorded banking activity</p>{banking.isLoading ? <><ValueSkeleton className="mt-6"/><Skeleton className="mt-2 h-3 w-40"/></> : <><p className="mt-6 text-2xl font-semibold tabular-nums text-[#17303d]">{formatCurrency(modules[2].value)}</p><p className="mt-1 text-xs text-[#718791]">{modules[2].total} transactions in this period</p></>}<Link href="/banking/transactions" className="mt-5 inline-flex items-center gap-1 text-xs font-medium text-[#007DCC]">Review banking <ArrowRight size={13}/></Link></Card>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map(({ title, href, icon: Icon, total, value, loading }) => <Card key={href} className="rounded-xl p-4"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-lg bg-[#edf7fc] text-[#007DCC]"><Icon size={17}/></span><div className="flex-1"><h2 className="text-sm font-medium text-[#29424e]">{title}</h2>{loading ? <Skeleton className="mt-1 h-3 w-28"/> : <p className="text-[11px] text-[#788b96]">{total} records · {formatCurrency(value)}</p>}</div><Link href={href} aria-label={`View all ${title}`} className="text-[#007DCC]"><ArrowRight size={15}/></Link></div></Card>)}
      </div>

      <Card className="mt-3 overflow-hidden rounded-xl">
        <div className="border-b border-[#edf1f4] px-5 py-3"><h2 className="text-sm font-semibold text-[#203540]">Recent activity</h2><p className="mt-0.5 text-[11px] text-[#7c8f9a]">Latest records in the selected period</p></div>
        <div className="divide-y divide-[#edf1f4]">{recent.map((record) => <Link key={record.id} href={`${record.href}/${record.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 hover:bg-[#f8fbfd]"><div><p className="text-xs font-medium text-[#2b414c]">{recordTitle(record.data)}</p><p className="mt-0.5 text-[10px] text-[#82939d]">{record.module} / {record.resource} · {new Date(record.updatedAt).toLocaleString()}</p></div><div className="flex items-center gap-3"><Badge variant={record.status === "active" || record.status === "posted" ? "success" : "warning"}>{record.status}</Badge><ArrowRight size={14} className="text-[#007DCC]"/></div></Link>)}{anyLoading ? Array.from({length: Math.max(2, 5 - recent.length)}, (_, index) => <div key={`skeleton-${index}`} className="px-5 py-4"><Skeleton className="h-3.5 w-40"/><Skeleton className="mt-2 h-2.5 w-64"/></div>) : !recent.length ? <p className="p-8 text-center text-sm text-[#788b96]">No records in this date range.</p> : null}</div>
      </Card>
    </div>
  </AppShell>
}
