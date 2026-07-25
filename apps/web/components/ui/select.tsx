"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = "Select an option",
  name,
  className,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: string[];
  placeholder?: string;
  name?: string;
  className?: string;
}) {
  return (
    <SelectPrimitive.Root name={name} value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger className={cn("flex h-11 w-full items-center justify-between rounded-xl border border-[#dce6ed] bg-white px-3 text-left text-sm text-[#29414d] outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10", className)}>
        <SelectPrimitive.Value placeholder={placeholder}/>
        <SelectPrimitive.Icon><ChevronDown size={15} className="text-[#7d909c]"/></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={5} className="z-[100] max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-[#dce6ed] bg-white p-1.5 shadow-xl">
          <SelectPrimitive.Viewport>
            {options.map((option) => (
              <SelectPrimitive.Item key={option} value={option} className="relative flex cursor-pointer select-none items-center rounded-lg py-2.5 pl-3 pr-8 text-xs font-semibold text-[#405762] outline-none data-[highlighted]:bg-[#eaf5fc] data-[highlighted]:text-[#0069ad]">
                <SelectPrimitive.ItemText>{option}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5"><Check size={14}/></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
