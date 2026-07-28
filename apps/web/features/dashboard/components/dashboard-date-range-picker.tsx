"use client"

import { useEffect, useMemo, useState } from "react"
import * as Popover from "@radix-ui/react-popover"
import {
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from "date-fns"
import { CalendarDays, Check, ChevronDown } from "lucide-react"
import { DayPicker, type DateRange } from "react-day-picker"
import { cn } from "../../../lib/utils"

export interface DashboardDateRange {
  from: string
  to: string
  label: string
}

function date(value: string) {
  const parsed = value ? parseISO(value) : undefined
  return parsed && isValid(parsed) ? parsed : undefined
}

function iso(value?: Date) {
  return value ? format(value, "yyyy-MM-dd") : ""
}

export function dashboardRangeLabel(range: Pick<DashboardDateRange, "from" | "to">) {
  if (!range.from && !range.to) return "All time"
  if (range.from === range.to && range.from) return format(parseISO(range.from), "dd MMM yyyy")
  return `${range.from ? format(parseISO(range.from), "dd MMM yyyy") : "Beginning"} – ${range.to ? format(parseISO(range.to), "dd MMM yyyy") : "Today"}`
}

export function DashboardDateRangePicker({
  value,
  onChange,
}: {
  value: DashboardDateRange
  onChange: (range: DashboardDateRange) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<DateRange | undefined>({
    from: date(value.from),
    to: date(value.to),
  })
  const today = useMemo(() => new Date(), [])
  useEffect(() => {
    if (!open)
      setDraft(value.from || value.to ? { from: date(value.from), to: date(value.to) } : undefined)
  }, [open, value.from, value.to])

  const presets = useMemo(() => [
    { label: "All", range: undefined },
    { label: "Today", range: { from: today, to: today } },
    { label: "Yesterday", range: { from: subDays(today, 1), to: subDays(today, 1) } },
    { label: "Last 7 days", range: { from: subDays(today, 6), to: today } },
    { label: "Last 14 days", range: { from: subDays(today, 13), to: today } },
    { label: "Last 30 days", range: { from: subDays(today, 29), to: today } },
    { label: "This week", range: { from: startOfWeek(today), to: endOfWeek(today) } },
    { label: "Last week", range: { from: startOfWeek(subWeeks(today, 1)), to: endOfWeek(subWeeks(today, 1)) } },
    { label: "This month", range: { from: startOfMonth(today), to: endOfMonth(today) } },
    { label: "Last month", range: { from: startOfMonth(subMonths(today, 1)), to: endOfMonth(subMonths(today, 1)) } },
  ], [today])

  const activeLabel = presets.find((preset) =>
    iso(preset.range?.from) === iso(draft?.from) &&
    iso(preset.range?.to) === iso(draft?.to),
  )?.label

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex h-10 min-w-[250px] items-center justify-between gap-3 rounded-xl border border-[#d8e2e8] bg-white px-3 text-left shadow-sm outline-none hover:border-[#9fcbe6] focus:ring-4 focus:ring-[#007DCC]/10">
        <span className="flex items-center gap-2"><CalendarDays size={16} className="text-[#007DCC]"/><span><span className="block text-[10px] font-medium uppercase tracking-wide text-[#80919b]">Reporting period</span><span className="block text-xs font-semibold text-[#29424e]">{dashboardRangeLabel(value)}</span></span></span>
        <ChevronDown size={15} className={cn("text-[#71848f] transition", open && "rotate-180")}/>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={12} className="z-[190] w-[min(760px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-[#dce5ea] bg-white shadow-[0_28px_90px_rgba(12,39,56,.24)]">
          <div className="grid md:grid-cols-[1fr_180px]">
            <div className="min-w-0 p-4">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="rounded-xl border border-[#dce5ea] bg-[#f8fafb] px-3 py-2"><p className="text-[9px] uppercase text-[#82949e]">From</p><p className="text-xs font-semibold text-[#29424e]">{draft?.from ? format(draft.from, "dd MMM yyyy") : "Beginning"}</p></div>
                <span className="text-[#9aabb4]">–</span>
                <div className="rounded-xl border border-[#dce5ea] bg-[#f8fafb] px-3 py-2"><p className="text-[9px] uppercase text-[#82949e]">To</p><p className="text-xs font-semibold text-[#29424e]">{draft?.to ? format(draft.to, "dd MMM yyyy") : "Today"}</p></div>
              </div>
              <DayPicker
                mode="range"
                selected={draft}
                onSelect={setDraft}
                numberOfMonths={2}
                defaultMonth={draft?.from ?? startOfMonth(today)}
                classNames={{
                  months: "grid gap-5 sm:grid-cols-2",
                  month: "min-w-0 space-y-3",
                  month_caption: "flex h-9 items-center justify-center border-b border-[#edf1f4] pb-2",
                  caption_label: "text-xs font-semibold text-[#213946]",
                  nav: "absolute left-4 right-[196px] top-[91px] flex justify-between pointer-events-none",
                  button_previous: "pointer-events-auto grid size-7 place-items-center rounded-lg border bg-white text-[#536b78] hover:text-[#007DCC]",
                  button_next: "pointer-events-auto grid size-7 place-items-center rounded-lg border bg-white text-[#536b78] hover:text-[#007DCC]",
                  month_grid: "w-full border-collapse",
                  weekdays: "grid grid-cols-7",
                  weekday: "grid h-7 place-items-center text-[9px] font-semibold uppercase text-[#8798a2]",
                  week: "grid grid-cols-7",
                  day: "grid h-8 place-items-center text-xs",
                  day_button: "grid size-8 place-items-center rounded-lg text-[#314954] hover:bg-[#eaf5fc] hover:text-[#007DCC]",
                  range_start: "rounded-l-lg bg-[#007DCC] [&>button]:bg-[#007DCC] [&>button]:text-white",
                  range_end: "rounded-r-lg bg-[#007DCC] [&>button]:bg-[#007DCC] [&>button]:text-white",
                  range_middle: "bg-[#eaf5fc] [&>button]:rounded-none [&>button]:text-[#0069ad]",
                  selected: "[&>button]:font-semibold",
                  today: "[&>button]:ring-1 [&>button]:ring-[#007DCC]",
                  outside: "opacity-35",
                }}
              />
            </div>
            <aside className="border-t border-[#e6ecef] bg-[#f9fbfc] p-3 md:border-l md:border-t-0">
              <p className="px-2 pb-2 text-[9px] font-semibold uppercase tracking-[.12em] text-[#81939d]">Quick ranges</p>
              <div className="space-y-0.5">{presets.map((preset) => <button key={preset.label} onClick={() => setDraft(preset.range)} className={cn("flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs text-[#405762] hover:bg-white hover:text-[#007DCC]", activeLabel === preset.label && "bg-white font-semibold text-[#007DCC] shadow-sm")}><span>{preset.label}</span>{activeLabel === preset.label ? <Check size={14}/> : null}</button>)}</div>
            </aside>
          </div>
          <div className="flex items-center justify-between border-t border-[#e6ecef] bg-white px-4 py-3">
            <p className="text-[10px] text-[#7b8d97]">{activeLabel ?? "Custom range"}</p>
            <div className="flex gap-2"><button onClick={() => setOpen(false)} className="h-9 rounded-lg px-4 text-xs font-semibold text-[#607681] hover:bg-[#f4f7f9]">Cancel</button><button onClick={() => { const next = { from: iso(draft?.from), to: iso(draft?.to ?? draft?.from), label: activeLabel ?? "Custom" }; onChange(next); setOpen(false) }} className="h-9 rounded-lg bg-[#007DCC] px-5 text-xs font-semibold text-white hover:bg-[#0069ad]">Update</button></div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
