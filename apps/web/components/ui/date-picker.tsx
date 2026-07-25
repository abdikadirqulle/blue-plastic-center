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
        <Popover.Content align="start" sideOffset={6} className="z-[100] rounded-2xl border border-[#dce6ed] bg-white p-3 shadow-2xl">
          <DayPicker
            mode="single"
            selected={selected}
            onSelect={(date) => date && onChange(format(date, "yyyy-MM-dd"))}
            captionLayout="dropdown"
            startMonth={new Date(2000, 0)}
            endMonth={new Date(2035, 11)}
            classNames={{
              months: "flex",
              month: "space-y-3",
              month_caption: "flex h-9 items-center justify-center font-bold text-sm",
              dropdowns: "flex items-center justify-center gap-2",
              dropdown: "rounded-lg border border-[#dce6ed] bg-white px-2 py-1 text-xs",
              weekdays: "flex",
              weekday: "w-9 text-center text-[10px] font-bold uppercase text-[#81939d]",
              week: "mt-1 flex",
              day: "size-9 text-center text-xs",
              day_button: "size-9 rounded-lg hover:bg-[#eaf5fc]",
              selected: "rounded-lg bg-[#007DCC] text-white hover:bg-[#0069ad]",
              today: "font-bold text-[#007DCC]",
              outside: "text-[#b5c0c6]",
              disabled: "opacity-40",
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
