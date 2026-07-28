"use client"

import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { Link } from "@/components/routing"
import { Skeleton } from "../../../components/ui/skeleton"
import { formatCurrency } from "../../../lib/utils"

export interface FinancialChartPoint {
  label: string
  sales: number
  expenses: number
}

export function IncomeExpenseChart({
  points,
  loading,
}: {
  points: FinancialChartPoint[]
  loading: boolean
}) {
  const [hovered, setHovered] = useState<number | null>(null)
  const max = Math.max(...points.flatMap((point) => [point.sales, point.expenses]), 1)
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-sm font-semibold text-[#233d49]">Income and expenses</h2><p className="mt-1 text-[11px] text-[#7a8e98]">Updates with the selected reporting period</p></div>
        <div className="flex gap-3 text-[10px] text-[#687d88]"><span><i className="mr-1 inline-block size-2 rounded-full bg-[#007DCC]"/>Sales</span><span><i className="mr-1 inline-block size-2 rounded-full bg-[#f59e0b]"/>Expenses</span></div>
      </div>
      {loading ? <Skeleton className="mt-6 h-52 w-full"/> : (
        <div className="relative mt-5">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-7">{Array.from({length: 4}, (_, index) => <span key={index} className="border-t border-dashed border-[#e7edf1]"/>)}</div>
          <div className="relative flex h-52 items-end gap-2 pb-7">
            {points.map((point, index) => (
              <button key={`${point.label}-${index}`} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(index)} onBlur={() => setHovered(null)} className="group relative flex h-full min-w-0 flex-1 items-end justify-center gap-1 outline-none">
                {hovered === index ? <span className="absolute bottom-[calc(100%+8px)] z-10 min-w-36 rounded-xl bg-[#102d40] p-3 text-left text-[10px] text-white shadow-xl"><strong className="block text-xs">{point.label}</strong><span className="mt-2 flex justify-between gap-4"><span>Sales</span><b>{formatCurrency(point.sales)}</b></span><span className="mt-1 flex justify-between gap-4"><span>Expenses</span><b>{formatCurrency(point.expenses)}</b></span></span> : null}
                <span className="w-[38%] rounded-t-md bg-[#007DCC] transition-all group-hover:bg-[#0069ad]" style={{height: `${Math.max(point.sales / max * 100, point.sales ? 4 : 1)}%`}}/>
                <span className="w-[38%] rounded-t-md bg-[#f59e0b] transition-all group-hover:bg-[#d97706]" style={{height: `${Math.max(point.expenses / max * 100, point.expenses ? 4 : 1)}%`}}/>
                <span className="absolute bottom-0 left-1/2 max-w-full -translate-x-1/2 truncate text-[9px] text-[#758994]">{point.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ReceivablesChart({
  paid,
  open,
  overdue,
  loading,
}: {
  paid: number
  open: number
  overdue: number
  loading: boolean
}) {
  const total = paid + open + overdue
  const paidAngle = total ? paid / total * 360 : 0
  const openAngle = total ? open / total * 360 : 0
  return <div><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold text-[#233d49]">Receivables health</h2><p className="mt-1 text-[11px] text-[#7a8e98]">Invoice value by collection status</p></div><Link href="/sales/invoices" className="text-[#007DCC]"><ArrowRight size={15}/></Link></div>{loading ? <Skeleton className="mx-auto mt-6 size-36 rounded-full"/> : <div className="mt-5 grid items-center gap-5 sm:grid-cols-[145px_1fr]"><div className="relative mx-auto size-36 rounded-full" style={{background: `conic-gradient(#10b981 0deg ${paidAngle}deg,#007DCC ${paidAngle}deg ${paidAngle + openAngle}deg,#ef4444 ${paidAngle + openAngle}deg 360deg)`}}><div className="absolute inset-5 grid place-items-center rounded-full bg-white text-center"><span><b className="block text-lg text-[#213946]">{formatCurrency(total)}</b><small className="text-[9px] text-[#82949e]">Total invoices</small></span></div></div><div className="space-y-3">{[["Paid", paid, "bg-emerald-500"],["Open", open, "bg-[#007DCC]"],["Overdue", overdue, "bg-red-500"]].map(([label, value, color]) => <div key={String(label)} className="flex items-center gap-2 text-xs"><i className={`size-2.5 rounded-full ${color}`}/><span className="text-[#607681]">{label}</span><b className="ml-auto text-[#29424e]">{formatCurrency(Number(value))}</b></div>)}</div></div>}</div>
}

export function InventoryValueChart({
  items,
  loading,
}: {
  items: Array<{ name: string; value: number; quantity: number }>
  loading: boolean
}) {
  const max = Math.max(...items.map((item) => item.value), 1)
  return <div><div className="flex items-start justify-between"><div><h2 className="text-sm font-semibold text-[#233d49]">Inventory value</h2><p className="mt-1 text-[11px] text-[#7a8e98]">Highest stock value at cost</p></div><Link href="/inventory/items" className="text-[#007DCC]"><ArrowRight size={15}/></Link></div>{loading ? <div className="mt-6 space-y-4">{Array.from({length:4},(_,index)=><Skeleton key={index} className="h-8 w-full"/>)}</div> : <div className="mt-5 space-y-4">{items.slice(0,4).map((item) => <div key={item.name}><div className="mb-1 flex justify-between gap-3 text-[10px]"><span className="truncate text-[#526974]">{item.name}</span><b className="shrink-0 text-[#29424e]">{formatCurrency(item.value)}</b></div><div className="h-2 overflow-hidden rounded-full bg-[#edf2f5]"><div className="h-full rounded-full bg-violet-500" style={{width:`${item.value / max * 100}%`}}/></div><p className="mt-1 text-[9px] text-[#8a9aa3]">{item.quantity.toLocaleString()} units</p></div>)}</div>}</div>
}
