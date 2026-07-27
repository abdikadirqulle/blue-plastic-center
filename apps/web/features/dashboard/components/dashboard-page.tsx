"use client"

import { Link } from "@/components/routing"
import { ArrowRight, Box, BriefcaseBusiness, FileText, Landmark, Receipt, Users } from "lucide-react"
import { AppShell } from "../../../components/layout/app-shell"
import { Badge } from "../../../components/ui/badge"
import { Card } from "../../../components/ui/card"
import { formatCurrency } from "../../../lib/utils"
import { useResourceList } from "../../resources/resource-api"

const sources = [
  { module: "sales", resource: "invoices", title: "Sales & receivables", href: "/sales/invoices", icon: FileText },
  { module: "purchasing", resource: "bills", title: "Purchasing & payables", href: "/purchasing/bills", icon: Receipt },
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

function title(data: Record<string, unknown>) {
  for (const key of ["documentNumber", "displayName", "name", "description", "reference", "sku"]) {
    if (data[key]) return String(data[key])
  }
  return "Database record"
}

export function DashboardPage() {
  const invoices = useResourceList("sales", "invoices", { page: 1, pageSize: 20 })
  const bills = useResourceList("purchasing", "bills", { page: 1, pageSize: 20 })
  const banking = useResourceList("banking", "transactions", { page: 1, pageSize: 20 })
  const inventory = useResourceList("inventory", "items", { page: 1, pageSize: 20 })
  const projects = useResourceList("projects", "projects", { page: 1, pageSize: 20 })
  const employees = useResourceList("payroll", "employees", { page: 1, pageSize: 20 })
  const queries = [invoices, bills, banking, inventory, projects, employees]
  const moduleCards = sources.map((source, index) => {
    const response = queries[index].data
    const records = response?.data ?? []
    return { ...source, records, total: response?.meta?.total ?? records.length, value: records.reduce((sum, record) => sum + amount(record.data), 0) }
  })
  const recent = moduleCards.flatMap((source) => source.records.map((record) => ({ ...record, href: source.href }))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8)
  const invoiceTotal = moduleCards[0].value
  const billTotal = moduleCards[1].value
  const bankTotal = moduleCards[2].value

  return <AppShell>
    <div className="mx-auto max-w-[1500px]">
      <p className="text-xs font-bold text-[#007DCC]">Live company overview</p>
      <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><h1 className="text-3xl font-bold text-[#142735]">Dashboard</h1><p className="mt-2 text-sm text-[#6b7e8a]">Every value below is calculated from records returned by the REST API.</p></div>
        <Link href="/reports/financial" className="flex items-center gap-2 text-xs font-bold text-[#007DCC]">Open reports <ArrowRight size={14}/></Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Invoice total", invoiceTotal, `${moduleCards[0].total} records`],
          ["Bills total", billTotal, `${moduleCards[1].total} records`],
          ["Net operating position", invoiceTotal - billTotal, "Invoices less bills"],
          ["Bank transactions", bankTotal, `${moduleCards[2].total} records`],
        ].map(([label, value, helper]) => <Card key={String(label)} className="p-5"><p className="text-xs font-semibold text-[#6d808c]">{label}</p><p className="mt-3 text-2xl font-bold text-[#152936]">{formatCurrency(Number(value))}</p><p className="mt-2 text-[11px] font-semibold text-[#007DCC]">{helper}</p></Card>)}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {moduleCards.map(({ title: label, href, icon: Icon, total, value }) => <Card key={href} className="p-5"><div className="flex items-start justify-between"><span className="grid size-10 place-items-center rounded-xl bg-[#eaf5fc] text-[#007DCC]"><Icon size={18}/></span><span className="text-2xl font-bold text-[#17303d]">{total}</span></div><h2 className="mt-4 text-sm font-bold text-[#29424e]">{label}</h2><p className="mt-1 text-xs text-[#788b96]">{value ? `${formatCurrency(value)} recorded value` : "No monetary field on these records"}</p><Link href={href} className="mt-4 flex items-center gap-2 text-xs font-bold text-[#007DCC]">View all <ArrowRight size={14}/></Link></Card>)}
      </div>

      <Card className="mt-4 overflow-hidden">
        <div className="border-b border-[#edf1f4] px-5 py-4"><h2 className="text-sm font-bold text-[#203540]">Recent database activity</h2><p className="mt-1 text-xs text-[#7c8f9a]">Newest live records across core modules</p></div>
        <div className="divide-y divide-[#edf1f4]">{recent.length ? recent.map((record) => <Link key={record.id} href={`${record.href}/${record.id}`} className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 hover:bg-[#f8fbfd]"><div><p className="text-xs font-bold text-[#2b414c]">{title(record.data)}</p><p className="mt-1 text-[11px] text-[#82939d]">{record.module} / {record.resource} · {new Date(record.updatedAt).toLocaleString()}</p></div><div className="flex items-center gap-3"><Badge variant={record.status === "active" || record.status === "posted" ? "success" : "warning"}>{record.status}</Badge><ArrowRight size={14} className="text-[#007DCC]"/></div></Link>) : <p className="p-8 text-center text-sm text-[#788b96]">No database records yet. Create or import a record to populate the dashboard.</p>}</div>
      </Card>
    </div>
  </AppShell>
}
