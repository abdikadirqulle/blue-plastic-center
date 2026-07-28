"use client"

import { useMemo, useState } from "react"
import { CheckCheck, CircleAlert, Filter, Inbox, LoaderCircle, PackageSearch, ReceiptText, ShieldCheck } from "lucide-react"
import { Link } from "../../components/routing"
import { AppShell } from "../../components/layout/app-shell"
import { Badge } from "../../components/ui/badge"
import { Card } from "../../components/ui/card"
import { Skeleton } from "../../components/ui/skeleton"
import { Select } from "../../components/ui/select"
import { Toast, type ToastMessage } from "../../components/ui/toast"
import { cn } from "../../lib/utils"
import { useNotificationActions, useNotifications, type NotificationRecord } from "./notification-api"

const iconByCategory = (category: string) =>
  /inventory/i.test(category) ? PackageSearch : /payable|vendor/i.test(category) ? ReceiptText : /security/i.test(category) ? ShieldCheck : CircleAlert

const tone = {
  critical: "bg-red-50 text-red-600",
  warning: "bg-amber-50 text-amber-700",
  success: "bg-emerald-50 text-emerald-700",
  info: "bg-sky-50 text-[#007DCC]",
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes} min ago`
  if (minutes < 1_440) return `${Math.floor(minutes / 60)} hr ago`
  return new Date(value).toLocaleDateString()
}

export default function NotificationsPage() {
  const notifications = useNotifications()
  const actions = useNotificationActions()
  const [filter, setFilter] = useState("All")
  const [message, setMessage] = useState<ToastMessage | null>(null)
  const records = useMemo(
    () => [...(notifications.data?.data ?? [])].sort((a, b) => String(b.data.occurredAt).localeCompare(String(a.data.occurredAt))),
    [notifications.data],
  )
  const visible = records.filter((record) =>
    filter === "All" || (filter === "Unread" ? record.status !== "read" : filter === "Needs action" ? record.data.actionRequired : record.data.category === filter),
  )
  const unread = records.filter((record) => record.status !== "read")
  const today = new Date().toISOString().slice(0, 10)
  const todayCount = records.filter((record) => String(record.data.occurredAt).slice(0, 10) === today).length
  const needsAction = records.filter((record) => record.data.actionRequired && record.status !== "read").length

  const read = (record: NotificationRecord) => {
    if (record.status === "read") return
    actions.markRead.mutate(record, {
      onError: (error) => setMessage({ title: "Notification not updated", description: error instanceof Error ? error.message : "Unable to mark as read.", variant: "error" }),
    })
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-semibold text-[#007DCC]">Activity center</p><h1 className="mt-2 text-2xl font-semibold tracking-[-0.025em] text-[#142735]">Notifications</h1><p className="mt-1.5 text-sm text-[#6b7e8a]">Database-backed alerts and updates requiring your review.</p></div>
          <button disabled={!unread.length || actions.markAllRead.isPending} onClick={() => actions.markAllRead.mutate(unread, { onSuccess: () => setMessage({ title: "All notifications marked as read", variant: "success" }), onError: (error) => setMessage({ title: "Notifications not updated", description: error instanceof Error ? error.message : "Please try again.", variant: "error" }) })} className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-4 text-xs font-semibold text-[#405762] hover:border-[#007DCC] hover:text-[#007DCC] disabled:opacity-50">{actions.markAllRead.isPending ? <LoaderCircle size={16} className="animate-spin"/> : <CheckCheck size={16}/>} Mark all as read</button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[["Unread", unread.length, "text-[#17303d]"], ["Today", todayCount, "text-[#17303d]"], ["Needs action", needsAction, "text-red-600"]].map(([label, value, color]) => <Card key={String(label)} className="p-4"><p className="text-xs font-medium text-[#71848f]">{label}</p>{notifications.isLoading ? <Skeleton className="mt-3 h-7 w-12"/> : <p className={cn("mt-2 text-2xl font-semibold", String(color))}>{value}</p>}</Card>)}
        </div>
        <Card className="mt-4 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e7edf1] px-5 py-4">
            <div><h2 className="text-sm font-semibold text-[#263f4b]">Notification inbox</h2><p className="mt-1 text-xs text-[#82949e]">{visible.length} notifications shown</p></div>
            <div className="flex items-center gap-2"><Filter size={15} className="text-[#758995]"/><Select value={filter} onValueChange={setFilter} searchable={false} options={["All", "Unread", "Needs action", ...new Set(records.map((record) => record.data.category))]} className="h-9 min-w-44"/></div>
          </div>
          {notifications.isLoading ? <div className="divide-y divide-[#edf1f4]">{Array.from({ length: 4 }, (_, index) => <div key={index} className="flex gap-4 px-5 py-5"><Skeleton className="size-10 rounded-xl"/><div className="flex-1"><Skeleton className="h-3.5 w-56"/><Skeleton className="mt-2 h-3 w-4/5"/><Skeleton className="mt-2 h-2.5 w-20"/></div></div>)}</div> : notifications.isError ? <div className="px-6 py-14 text-center"><CircleAlert className="mx-auto text-red-500"/><p className="mt-3 text-sm font-semibold text-[#304853]">Notifications could not be loaded</p><button onClick={() => void notifications.refetch()} className="mt-3 text-xs font-semibold text-[#007DCC]">Try again</button></div> : visible.length ? (
            <div className="divide-y divide-[#edf1f4]">{visible.map((record) => {
              const Icon = iconByCategory(record.data.category)
              const unreadRecord = record.status !== "read"
              return <Link key={record.id} href={record.data.href} onClick={() => read(record)} className={cn("flex items-start gap-4 px-5 py-4 transition hover:bg-[#f8fbfd]", unreadRecord && "bg-[#fbfdff]")}>
                <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", tone[record.data.severity] ?? tone.info)}><Icon size={18}/></span>
                <span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-[#304853]">{record.data.title}</span>{unreadRecord ? <span className="size-2 rounded-full bg-[#007DCC]"/> : null}</span><span className="mt-1 block text-xs leading-5 text-[#71848f]">{record.data.message}</span><span className="mt-2 block text-[10px] text-[#94a2aa]">{relativeTime(record.data.occurredAt)} · {new Date(record.data.occurredAt).toLocaleString()}</span></span>
                <div className="flex flex-col items-end gap-2"><Badge variant={unreadRecord ? "warning" : "neutral"}>{record.data.category}</Badge>{record.data.actionRequired ? <span className="text-[9px] font-semibold uppercase tracking-wide text-red-500">Action required</span> : null}</div>
              </Link>
            })}</div>
          ) : <div className="px-6 py-16 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#eef7fd] text-[#007DCC]"><Inbox size={22}/></span><p className="mt-3 text-sm font-semibold text-[#304853]">You’re all caught up</p><p className="mt-1 text-xs text-[#82949e]">No notifications match this filter.</p></div>}
        </Card>
      </div>
      <Toast message={message} onClose={() => setMessage(null)}/>
    </AppShell>
  )
}
