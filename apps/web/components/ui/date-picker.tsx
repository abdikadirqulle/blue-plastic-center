"use client";

import * as Popover from "@radix-ui/react-popover";
import { format, isValid, parseISO } from "date-fns";
import { CalendarDays } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { cn } from "../../lib/utils";

function parse(value?: string) {
  if (!value) return undefined;
  const date = parseISO(value);
  return isValid(date) ? date : undefined;
}

export function DatePicker({
  value,
  onChange,
  name,
  placeholder = "Pick a date",
  className,
}: {
  value?: string;
  onChange: (value: string) => void;
  name?: string;
  placeholder?: string;
  className?: string;
}) {
  const selected = parse(value);

  return (
    <Popover.Root>
      <input type="hidden" name={name} value={value ?? ""}/>
      <Popover.Trigger className={cn("flex h-11 w-full items-center justify-between rounded-xl border border-[#dce6ed] bg-white px-3 text-left text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10", !selected && "text-[#8798a2]", className)}>
        <span>{selected ? format(selected, "dd MMM yyyy") : placeholder}</span>
        <CalendarDays size={16} className="text-[#007DCC]"/>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={8} className="z-[100] w-[316px] rounded-2xl border border-[#dce6ed] bg-white p-4 shadow-[0_20px_60px_rgba(20,45,60,0.18)]">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => date && onChange(format(date, "yyyy-MM-dd"))}
            startMonth={new Date(2000, 0)}
            endMonth={new Date(2035, 11)}
            classNames={{
              months: "w-full",
              month: "w-full space-y-3",
              month_caption: "flex h-10 items-center justify-center border-b border-[#edf1f4] pb-3",
              caption_label: "text-sm font-bold tracking-[-0.01em] text-[#213946]",
              nav: "absolute inset-x-4 top-4 flex items-center justify-between",
              button_previous: "grid size-8 place-items-center rounded-lg border border-[#dce6ed] bg-white text-[#536b78] hover:border-[#007DCC] hover:bg-[#eaf5fc] hover:text-[#007DCC]",
              button_next: "grid size-8 place-items-center rounded-lg border border-[#dce6ed] bg-white text-[#536b78] hover:border-[#007DCC] hover:bg-[#eaf5fc] hover:text-[#007DCC]",
              month_grid: "w-full border-collapse",
              weekdays: "grid grid-cols-7 pt-1",
              weekday: "grid h-8 place-items-center text-[10px] font-bold uppercase tracking-wide text-[#81939d]",
              week: "mt-1 grid grid-cols-7",
              day: "grid size-10 place-items-center text-xs",
              day_button: "grid size-9 place-items-center rounded-xl font-semibold text-[#314954] transition hover:bg-[#eaf5fc] hover:text-[#007DCC]",
              selected: "rounded-xl bg-[#007DCC] text-white [&>button]:bg-[#007DCC] [&>button]:text-white [&>button]:hover:bg-[#0069ad]",
              today: "rounded-xl bg-[#f0f7fb] font-bold text-[#007DCC]",
              outside: "text-[#b5c0c6]",
              disabled: "opacity-40",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
