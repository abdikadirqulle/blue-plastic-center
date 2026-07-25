"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, CheckCheck, CircleAlert, PackageSearch, ReceiptText, Users } from "lucide-react";
import { AppShell } from "../../components/layout/app-shell";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";

const initialNotifications = [
  { id: "NTF-101", title: "3 invoices are overdue", detail: "$18,240 requires collection follow-up.", time: "12 min ago", type: "Sales", href: "/sales/invoices", icon: CircleAlert, unread: true, tone: "bg-red-50 text-red-600" },
  { id: "NTF-102", title: "5 items are below reorder level", detail: "Cement, rice, and cooking oil need attention.", time: "38 min ago", type: "Inventory", href: "/inventory/stock-levels", icon: PackageSearch, unread: true, tone: "bg-amber-50 text-amber-700" },
  { id: "NTF-103", title: "Payroll approval is pending", detail: "July payroll for 52 employees is ready.", time: "1 hr ago", type: "Payroll", href: "/payroll/pay-runs", icon: Users, unread: true, tone: "bg-violet-50 text-violet-700" },
  { id: "NTF-104", title: "Vendor bill approved", detail: "BILL-0628 for Horn Logistics was approved.", time: "3 hr ago", type: "Purchasing", href: "/purchasing/bills", icon: ReceiptText, unread: false, tone: "bg-emerald-50 text-emerald-700" },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const unread = notifications.filter((item) => item.unread).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-bold text-[#007DCC]">Activity center</p><h1 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">Notifications</h1><p className="mt-1.5 text-sm text-[#6b7e8a]">Updates requiring your review across Al-Furat Group.</p></div>
          <button onClick={() => setNotifications((items) => items.map((item) => ({...item, unread:false})))} className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-4 text-xs font-bold text-[#405762] hover:border-[#007DCC] hover:text-[#007DCC]"><CheckCheck size={16}/> Mark all as read</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card className="p-4"><p className="text-xs font-semibold text-[#71848f]">Unread</p><p className="mt-2 text-2xl font-bold text-[#17303d]">{unread}</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold text-[#71848f]">Today</p><p className="mt-2 text-2xl font-bold text-[#17303d]">4</p></Card>
          <Card className="p-4"><p className="text-xs font-semibold text-[#71848f]">Needs action</p><p className="mt-2 text-2xl font-bold text-red-600">3</p></Card>
        </div>
        <Card className="mt-4 overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#e7edf1] px-5 py-4"><div><h2 className="text-sm font-bold text-[#263f4b]">Latest notifications</h2><p className="mt-1 text-xs text-[#82949e]">Select an update to open its workspace.</p></div><Bell size={18} className="text-[#007DCC]"/></div>
          <div className="divide-y divide-[#edf1f4]">
            {notifications.map(({id,title,detail,time,type,href,icon:Icon,unread,tone}) => (
              <Link key={id} href={href} onClick={() => setNotifications((items) => items.map((item) => item.id === id ? {...item, unread:false} : item))} className="flex items-start gap-4 px-5 py-4 hover:bg-[#f8fbfd]">
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={18}/></span>
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-xs font-bold text-[#304853]">{title}</span>{unread ? <span className="size-2 rounded-full bg-[#007DCC]"/> : null}</span><span className="mt-1 block text-xs text-[#71848f]">{detail}</span><span className="mt-2 block text-[10px] text-[#94a2aa]">{time}</span></span>
                <Badge variant={unread ? "warning" : "neutral"}>{type}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
