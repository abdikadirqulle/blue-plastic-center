"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  BarChart3,
  Box,
  BriefcaseBusiness,
  CalendarDays,
  Calculator,
  CircleAlert,
  FileText,
  Landmark,
  Receipt,
  Repeat2,
  Settings,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { cn, formatCurrency } from "../../../lib/utils";
import { activities, cashFlow, metrics } from "../data";

const quickActions = [
  { label: "New invoice", icon: FileText, href: "/sales/invoices/new", color: "bg-sky-50 text-[#007DCC]" },
  { label: "Record expense", icon: Receipt, href: "/purchasing/expenses/new", color: "bg-violet-50 text-violet-700" },
  { label: "Add customer", icon: Users, href: "/sales/customers/new", color: "bg-blue-50 text-blue-700" },
  { label: "Stock transfer", icon: Repeat2, href: "/inventory/transfers/new", color: "bg-amber-50 text-amber-700" },
];

const activityIcons = { invoice: FileText, bill: Receipt, payment: Banknote, transfer: Repeat2 };
const statusVariant = { paid: "success", pending: "warning", overdue: "danger", completed: "neutral" } as const;

const moduleHighlights = [
  { title: "Sales & receivables", value: "$92,750", helper: "46 open invoices", href: "/sales/invoices", icon: FileText, tone: "bg-sky-50 text-[#007DCC]" },
  { title: "Purchasing & expenses", value: "$68,420", helper: "24 unpaid bills", href: "/purchasing/bills", icon: Receipt, tone: "bg-violet-50 text-violet-700" },
  { title: "Banking & treasury", value: "$146,380", helper: "6 cash accounts", href: "/banking/accounts", icon: Landmark, tone: "bg-emerald-50 text-emerald-700" },
  { title: "Items & inventory", value: "$428,650", helper: "18 low-stock items", href: "/inventory/items", icon: Box, tone: "bg-amber-50 text-amber-700" },
  { title: "Accounting", value: "Jul 2026", helper: "7 unposted journals", href: "/accounting/chart-of-accounts", icon: Calculator, tone: "bg-blue-50 text-blue-700" },
  { title: "Projects & job costing", value: "12 active", helper: "$48,620 unbilled", href: "/projects/projects", icon: BriefcaseBusiness, tone: "bg-indigo-50 text-indigo-700" },
  { title: "Payroll & people", value: "52 employees", helper: "$45,120 next payroll", href: "/payroll/pay-runs", icon: Users, tone: "bg-rose-50 text-rose-700" },
  { title: "Reports & insights", value: "42 reports", helper: "8 recently generated", href: "/reports/financial", icon: BarChart3, tone: "bg-cyan-50 text-cyan-700" },
  { title: "Company settings", value: "4 branches", helper: "18 active users", href: "/settings/company", icon: Settings, tone: "bg-slate-100 text-slate-700" },
];

const upcomingDeadlines = [
  { label: "Payroll approval", date: "28 Jul", helper: "52 employees", href: "/payroll/pay-runs" },
  { label: "VAT filing", date: "31 Jul", helper: "Jul 2026 period", href: "/accounting/fiscal-periods" },
  { label: "Inventory count", date: "02 Aug", helper: "Bakaaro warehouse", href: "/inventory/stock-counts" },
];

const salesLeaders = [
  { name: "Amina Yusuf", revenue: "$74,820", progress: 92 },
  { name: "Hassan Ali", revenue: "$62,450", progress: 78 },
  { name: "Abdi Noor", revenue: "$51,300", progress: 64 },
];

const budgetLines = [
  { label: "Operating expenses", actual: "$82,400", budget: "$96,000", progress: 86 },
  { label: "Purchasing", actual: "$118,200", budget: "$150,000", progress: 79 },
  { label: "Payroll", actual: "$45,120", budget: "$49,500", progress: 91 },
  { label: "Projects", actual: "$136,800", budget: "$180,000", progress: 76 },
];

export function DashboardPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="mb-1 text-xs font-semibold text-[#007DCC]">Saturday, 25 July</p>
            <h1 className="text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">
              Good evening, Abdikadir
            </h1>
            <p className="mt-1.5 text-sm text-[#6b7e8a]">Here&apos;s how Al-Furat Group is performing this month.</p>
          </div>
          <Link href="/accounting/chart-of-accounts" className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-xs font-semibold text-[#0069ad]">
            <span className="size-2 rounded-full bg-[#007DCC]" /> Books are balanced <ArrowRight size={14} />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => {
            const positive = metric.trend === "up";
            return (
              <Card key={metric.label} className="p-4 md:p-5">
                <p className="text-xs font-semibold text-[#6d808c]">{metric.label}</p>
                <p className="mt-3 text-2xl font-bold tracking-[-0.04em] text-[#152936]">
                  {formatCurrency(metric.value)}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[11px]">
                  <span className={cn("inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 font-bold", positive ? "bg-sky-50 text-[#007DCC]" : index === 2 ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600")}>
                    {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{metric.change}%
                  </span>
                  <span className="text-[#82939d]">{metric.helper}</span>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.8fr)]">
          <Card className="min-w-0 p-4 md:p-5">
            <div className="flex justify-between gap-3">
              <div><h2 className="text-sm font-bold text-[#203540]">Cash flow overview</h2><p className="mt-1 text-xs text-[#7c8f9a]">Money moving in and out of your business</p></div>
              <div className="flex gap-4 text-[11px] font-semibold text-[#667b87]">
                <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#007DCC]" />Inflow</span>
                <span className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-[#b9c8d1]" />Outflow</span>
              </div>
            </div>
            <div className="mt-8 flex h-[245px] items-end gap-3 border-b border-l border-[#e3eaf0] px-4 pt-4 sm:gap-6">
              {cashFlow.map((point) => (
                <div key={point.month} className="flex h-full flex-1 items-end justify-center gap-1">
                  <div className="relative flex h-full flex-1 items-end">
                    <span className="w-full rounded-t-md bg-[#007DCC]" style={{ height: `${point.inflow / 1.5}%` }} title={`Inflow $${point.inflow}k`} />
                  </div>
                  <div className="relative flex h-full flex-1 items-end">
                    <span className="w-full rounded-t-md bg-[#c6d2d9]" style={{ height: `${point.outflow / 1.5}%` }} title={`Outflow $${point.outflow}k`} />
                  </div>
                </div>
              ))}
            </div>
            <div className="ml-1 mt-2 flex justify-around text-[10px] font-medium text-[#7c8f9a]">
              {cashFlow.map((point) => <span key={point.month}>{point.month}</span>)}
            </div>
          </Card>

          <Card className="p-4 md:p-5">
            <div className="flex items-center justify-between">
              <div><h2 className="text-sm font-bold text-[#203540]">Receivables health</h2><p className="mt-1 text-xs text-[#7c8f9a]">Outstanding customer balances</p></div>
              <CircleAlert size={18} className="text-amber-500" />
            </div>
            <div className="mt-6 flex items-end gap-3"><p className="text-3xl font-bold tracking-[-0.045em] text-[#152936]">$92,750</p><span className="mb-1 text-xs text-[#7a8e99]">total due</span></div>
            <div className="mt-5 flex h-2.5 overflow-hidden rounded-full bg-slate-100"><span className="w-[61%] bg-[#007DCC]" /><span className="w-[19%] bg-amber-400" /><span className="w-[20%] bg-red-400" /></div>
            <div className="mt-5 space-y-4">
              {[["Current", "$56,580", "61%", "bg-[#007DCC]"],["Due in 30 days", "$17,930", "19%", "bg-amber-400"],["Overdue", "$18,240", "20%", "bg-red-400"]].map(([label,value,percent,color]) => (
                <div key={label} className="flex items-center gap-3"><span className={cn("size-2.5 rounded-full", color)} /><span className="flex-1 text-xs font-medium text-[#526873]">{label}</span><span className="text-xs font-bold text-[#253a45]">{value}</span><span className="w-8 text-right text-[10px] text-[#8999a2]">{percent}</span></div>
              ))}
            </div>
            <Link href="/sales/invoices" className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl border border-[#dfe7ed] py-2.5 text-xs font-bold text-[#36525f] hover:bg-[#f5f9fc]">
              Review receivables <ArrowRight size={14} />
            </Link>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#edf1f4] px-4 py-4 md:px-5">
              <div><h2 className="text-sm font-bold text-[#203540]">Recent activity</h2><p className="mt-1 text-xs text-[#7c8f9a]">Latest transactions across your company</p></div>
              <Link href="/accounting/audit-log" className="flex items-center gap-1 text-xs font-bold text-[#007DCC]">View all <ArrowRight size={14} /></Link>
            </div>
            <div className="divide-y divide-[#edf1f4]">
              {activities.map((activity) => {
                const Icon = activityIcons[activity.kind];
                return (
                  <Link href={activity.kind === "invoice" ? "/sales/invoices" : activity.kind === "bill" ? "/purchasing/bills" : activity.kind === "transfer" ? "/inventory/transfers" : "/banking/transactions"} key={activity.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3.5 hover:bg-[#f8fbfd] md:grid-cols-[auto_minmax(180px,1.4fr)_minmax(130px,1fr)_auto_auto] md:px-5">
                    <div className="grid size-9 place-items-center rounded-xl bg-[#eaf5fc] text-[#007DCC]"><Icon size={17} /></div>
                    <div className="min-w-0"><p className="truncate text-xs font-bold text-[#2b414c]">{activity.title}</p><p className="mt-0.5 text-[11px] text-[#82939d]">{activity.id}</p></div>
                    <p className="hidden truncate text-xs text-[#637984] md:block">{activity.detail}</p>
                    <div className="hidden md:block"><Badge variant={statusVariant[activity.status]}>{activity.status}</Badge></div>
                    <div className="text-right"><p className={cn("text-xs font-bold", activity.amount > 0 ? "text-[#007DCC]" : "text-[#263d48]")}>{activity.amount ? formatCurrency(activity.amount) : "—"}</p><p className="mt-0.5 text-[10px] text-[#929fa7]">{activity.time}</p></div>
                  </Link>
                );
              })}
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <Card className="p-4 md:p-5">
              <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-[#203540]">Quick actions</h2><Sparkles size={17} className="text-[#007DCC]" /></div>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {quickActions.map(({label,icon:Icon,href,color}) => (
                  <Link key={label} href={href} className="rounded-xl border border-[#e3eaf0] p-3 text-left hover:border-sky-200 hover:bg-sky-50/30">
                    <span className={cn("grid size-8 place-items-center rounded-lg",color)}><Icon size={16}/></span><span className="mt-2.5 block text-[11px] font-bold text-[#3b535f]">{label}</span>
                  </Link>
                ))}
              </div>
            </Card>
            <Card className="p-4 md:p-5">
              <div className="flex items-center justify-between"><h2 className="text-sm font-bold text-[#203540]">Inventory alerts</h2><Box size={17} className="text-[#6d808b]"/></div>
              <div className="mt-4 space-y-3">
                {[["Cement 50kg","12 left","Bakaaro"],["Premium Rice 25kg","8 left","Hodan"],["Cooking Oil 20L","5 left","Wadajir"]].map(([item,count,location],index) => (
                  <Link href="/inventory/stock-levels" key={item} className="flex items-center gap-3 rounded-xl bg-[#f6f9fb] p-2.5 hover:bg-[#eef6fb]">
                    <div className={cn("grid size-8 place-items-center rounded-lg",index===2?"bg-red-50 text-red-600":"bg-amber-50 text-amber-600")}><ShoppingBag size={15}/></div>
                    <div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold text-[#3b535f]">{item}</p><p className="mt-0.5 text-[10px] text-[#87969e]">{location}</p></div><span className="text-[10px] font-bold text-red-600">{count}</span>
                  </Link>
                ))}
              </div>
            </Card>
          </div>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#edf1f4] px-5 py-4">
              <div><h2 className="text-sm font-bold text-[#203540]">Payables health</h2><p className="mt-1 text-xs text-[#7c8f9a]">What your company owes vendors</p></div>
              <span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700"><WalletCards size={17}/></span>
            </div>
            <div className="grid grid-cols-3 divide-x divide-[#edf1f4] p-5">
              {[["Current","$38,720","57%"],["Due soon","$18,450","27%"],["Overdue","$11,250","16%"]].map(([label,value,share], index) => (
                <div key={label} className={cn("px-3 first:pl-0 last:pr-0", index === 2 && "text-red-700")}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#82939d]">{label}</p>
                  <p className="mt-2 text-lg font-bold tracking-[-0.03em]">{value}</p>
                  <p className="mt-1 text-[10px] font-semibold text-[#82939d]">{share} of payables</p>
                </div>
              ))}
            </div>
            <Link href="/purchasing/bills" className="flex items-center justify-between border-t border-[#edf1f4] px-5 py-3.5 text-xs font-bold text-[#007DCC]">View all vendor bills <ArrowRight size={14}/></Link>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#edf1f4] px-5 py-4">
              <div><h2 className="text-sm font-bold text-[#203540]">Upcoming deadlines</h2><p className="mt-1 text-xs text-[#7c8f9a]">Important work due in the next 7 days</p></div>
              <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><CalendarDays size={17}/></span>
            </div>
            <div className="divide-y divide-[#edf1f4] px-5">
              {upcomingDeadlines.map((item) => (
                <Link href={item.href} key={item.label} className="flex items-center gap-4 py-3.5 hover:text-[#007DCC]">
                  <span className="w-12 rounded-lg bg-[#f3f7fa] px-2 py-1.5 text-center text-[10px] font-bold text-[#526874]">{item.date}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-[#344d59]">{item.label}</span><span className="mt-0.5 block text-[10px] text-[#82939d]">{item.helper}</span></span>
                  <ArrowRight size={13} className="text-[#9aabb4]"/>
                </Link>
              ))}
            </div>
          </Card>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(300px,0.75fr)_minmax(0,1.25fr)]">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#edf1f4] px-5 py-4">
              <div><h2 className="text-sm font-bold text-[#203540]">Sales leaderboard</h2><p className="mt-1 text-xs text-[#7c8f9a]">Revenue performance this month</p></div>
              <TrendingUp size={18} className="text-emerald-600"/>
            </div>
            <div className="space-y-4 p-5">
              {salesLeaders.map((person, index) => (
                <div key={person.name}>
                  <div className="flex items-center gap-3">
                    <span className="grid size-7 place-items-center rounded-lg bg-[#eaf5fc] text-[10px] font-bold text-[#007DCC]">{index + 1}</span>
                    <span className="flex-1 text-xs font-bold text-[#344d59]">{person.name}</span>
                    <span className="text-xs font-bold text-[#203540]">{person.revenue}</span>
                  </div>
                  <div className="ml-10 mt-2 h-1.5 overflow-hidden rounded-full bg-[#edf2f5]"><span className="block h-full rounded-full bg-[#007DCC]" style={{width:`${person.progress}%`}}/></div>
                </div>
              ))}
            </div>
            <Link href="/reports/sales" className="flex items-center justify-between border-t border-[#edf1f4] px-5 py-3.5 text-xs font-bold text-[#007DCC]">View sales reports <ArrowRight size={14}/></Link>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#edf1f4] px-5 py-4">
              <div><h2 className="text-sm font-bold text-[#203540]">Budget vs actual</h2><p className="mt-1 text-xs text-[#7c8f9a]">Monthly spending against approved budgets</p></div>
              <span className="grid size-9 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><Target size={17}/></span>
            </div>
            <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
              {budgetLines.map((line) => (
                <div key={line.label}>
                  <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold text-[#344d59]">{line.label}</p><p className="mt-1 text-[10px] text-[#82939d]">{line.actual} of {line.budget}</p></div><span className="text-[11px] font-bold text-[#526874]">{line.progress}%</span></div>
                  <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-[#edf2f5]"><span className={cn("block h-full rounded-full", line.progress > 90 ? "bg-amber-500" : "bg-emerald-500")} style={{width:`${line.progress}%`}}/></div>
                </div>
              ))}
            </div>
            <Link href="/reports/financial" className="flex items-center justify-between border-t border-[#edf1f4] px-5 py-3.5 text-xs font-bold text-[#007DCC]">Open budget reports <ArrowRight size={14}/></Link>
          </Card>
        </div>

        <section className="mt-4">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-sm font-bold text-[#203540]">Business modules</h2>
              <p className="mt-1 text-xs text-[#7c8f9a]">A live snapshot from every area of your company</p>
            </div>
            <Link href="/sales/invoices" className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#007DCC]">Open workspace <ArrowRight size={14}/></Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {moduleHighlights.map(({ title, value, helper, href, icon: Icon, tone }) => (
              <Card key={title} className="group p-4 transition hover:border-sky-200 hover:shadow-sm">
                <div className="flex items-start gap-3">
                  <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone)}><Icon size={18}/></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[#304853]">{title}</p>
                    <p className="mt-2 text-lg font-bold tracking-[-0.03em] text-[#17303d]">{value}</p>
                    <p className="mt-0.5 text-[10px] text-[#82939d]">{helper}</p>
                  </div>
                </div>
                <Link href={href} className="mt-4 flex items-center justify-between border-t border-[#edf1f4] pt-3 text-[11px] font-bold text-[#007DCC]">
                  View all <ArrowRight size={13} className="transition group-hover:translate-x-0.5"/>
                </Link>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
