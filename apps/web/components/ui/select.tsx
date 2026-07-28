"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, Plus, Save, Search, X } from "lucide-react";
import { useState } from "react";
import { cn } from "../../lib/utils";

export type SelectOption = string | { label: string; value: string };
export type QuickAddKind = "contact" | "item" | "account";
export interface QuickAddInput {
  kind: QuickAddKind;
  name: string;
  code: string;
  contact: string;
  itemType: string;
  unit: string;
  salesPrice: string;
  purchaseCost: string;
  accountType: string;
}

export function Select({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = "Select an option",
  name,
  className,
  allowAddNew = false,
  addNewLabel = "record",
  searchable = true,
  quickAddKind = "contact",
  onCreateOption,
  onOptionCreated,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  name?: string;
  className?: string;
  allowAddNew?: boolean;
  addNewLabel?: string;
  searchable?: boolean;
  quickAddKind?: QuickAddKind;
  onCreateOption?: (input: QuickAddInput) => Promise<{ label: string; value: string }>;
  onOptionCreated?: (
    option: { label: string; value: string },
    input: QuickAddInput,
  ) => void;
}) {
  const [addedOptions, setAddedOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newContact, setNewContact] = useState("");
  const [search, setSearch] = useState("");
  const [itemType, setItemType] = useState("inventory");
  const [unit, setUnit] = useState("Each");
  const [salesPrice, setSalesPrice] = useState("");
  const [purchaseCost, setPurchaseCost] = useState("");
  const [accountType, setAccountType] = useState("expense");
  const [savingNew, setSavingNew] = useState(false);
  const [addError, setAddError] = useState("");

  const normalizedOptions = options.map((option) =>
    typeof option === "string" ? { label: option, value: option } : option,
  );
  const localOptions = [
    ...normalizedOptions,
    ...addedOptions
      .filter((added) => !normalizedOptions.some((option) => option.value === added.value)),
  ];
  const visibleOptions = localOptions.filter((option) =>
    `${option.label} ${option.value}`.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const selectValue = (nextValue: string) => {
    if (nextValue === "__add_new__") {
      setAddModalOpen(true);
      return;
    }
    onValueChange?.(nextValue);
  };

  const resetQuickAdd = () => {
    setNewName("");
    setNewCode("");
    setNewContact("");
    setItemType("inventory");
    setUnit("Each");
    setSalesPrice("");
    setPurchaseCost("");
    setAccountType("expense");
    setAddError("");
  };

  const saveNewOption = async () => {
    const label = newName.trim();
    if (!label) return;
    setSavingNew(true);
    setAddError("");
    try {
      const input: QuickAddInput = {
        kind: quickAddKind,
        name: label,
        code: newCode.trim(),
        contact: newContact.trim(),
        itemType,
        unit,
        salesPrice,
        purchaseCost,
        accountType,
      };
      const created = onCreateOption
        ? await onCreateOption(input)
        : { label, value: label };
      setAddedOptions((current) =>
        current.some((option) => option.value === created.value)
          ? current
          : [...current, created],
      );
      onValueChange?.(created.value);
      onOptionCreated?.(created, input);
      setAddModalOpen(false);
      resetQuickAdd();
    } catch (error) {
      setAddError(error instanceof Error ? error.message : "Unable to create this record");
    } finally {
      setSavingNew(false);
    }
  };

  return (
    <>
    <SelectPrimitive.Root
      name={name}
      value={value}
      defaultValue={defaultValue}
      onValueChange={selectValue}
      onOpenChange={(open) => {
        if (!open) setSearch("");
      }}
    >
      <SelectPrimitive.Trigger className={cn("flex h-11 w-full items-center justify-between rounded-xl border border-[#dce6ed] bg-white px-3 text-left text-sm text-[#29414d] outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10", className)}>
        <SelectPrimitive.Value placeholder={placeholder}/>
        <SelectPrimitive.Icon><ChevronDown size={15} className="text-[#7d909c]"/></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={5} className="z-[100] max-h-80 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-[#dce6ed] bg-white p-1.5 shadow-xl">
          {searchable ? (
            <div className="relative mb-1.5 border-b border-[#e6edf1] pb-1.5">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-[65%] text-[#80929d]" size={14}/>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder="Search options…"
                aria-label="Search options"
                className="h-9 w-full rounded-lg border border-[#dce6ed] bg-[#f8fafb] pl-8 pr-2 text-xs outline-none focus:border-[#007DCC] focus:bg-white"
              />
            </div>
          ) : null}
          <SelectPrimitive.Viewport>
            {visibleOptions.map((option) => (
              <SelectPrimitive.Item key={option.value} value={option.value} className="relative flex cursor-pointer select-none items-center rounded-lg py-2.5 pl-3 pr-8 text-xs font-semibold text-[#405762] outline-none data-[highlighted]:bg-[#eaf5fc] data-[highlighted]:text-[#0069ad]">
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2.5"><Check size={14}/></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
            {!visibleOptions.length ? (
              <p className="px-3 py-4 text-center text-xs text-[#758995]">
                No matching options
              </p>
            ) : null}
            {allowAddNew ? (
              <>
                <SelectPrimitive.Separator className="my-1 h-px bg-[#e6edf1]"/>
                <SelectPrimitive.Item value="__add_new__" className="flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-bold text-[#007DCC] outline-none data-[highlighted]:bg-[#eaf5fc]">
                  <Plus size={14}/><SelectPrimitive.ItemText>Add new {addNewLabel}</SelectPrimitive.ItemText>
                </SelectPrimitive.Item>
              </>
            ) : null}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
    {addModalOpen ? (
      <div onMouseDown={() => setAddModalOpen(false)} className="fixed inset-0 z-[130] grid place-items-center bg-[#071f33]/45 p-4 backdrop-blur-sm">
        <div role="dialog" aria-modal="true" aria-label={`Add new ${addNewLabel}`} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg rounded-2xl border border-[#dce6ed] bg-white shadow-[0_24px_80px_rgba(7,31,51,0.28)]">
          <div className="flex items-start justify-between border-b border-[#e7edf1] px-5 py-4">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#007DCC]">Quick add</p><h2 className="mt-1 text-lg font-bold text-[#213946]">Add new {addNewLabel}</h2><p className="mt-1 text-xs text-[#758894]">The current transaction stays open behind this window.</p></div>
            <button type="button" aria-label="Close quick add" onClick={() => setAddModalOpen(false)} className="rounded-lg p-2 text-[#71848f] hover:bg-[#f1f5f7]"><X size={17}/></button>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label className="text-xs font-bold text-[#405762] sm:col-span-2"><span className="mb-1.5 block">Name <span className="text-red-500">*</span></span><input autoFocus value={newName} onChange={(event) => setNewName(event.target.value)} placeholder={`Enter ${addNewLabel} name`} className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"/></label>
            <label className="text-xs font-bold text-[#405762]"><span className="mb-1.5 block">{quickAddKind === "item" ? "SKU" : quickAddKind === "account" ? "Account number" : "Code or reference"} <span className="text-red-500">*</span></span><input value={newCode} onChange={(event) => setNewCode(event.target.value)} placeholder={quickAddKind === "item" ? "ITEM-001" : quickAddKind === "account" ? "6000" : "Optional code"} className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"/></label>
            {quickAddKind === "contact" ? (
              <label className="text-xs font-bold text-[#405762]"><span className="mb-1.5 block">Email or phone</span><input value={newContact} onChange={(event) => setNewContact(event.target.value)} placeholder="Optional contact" className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"/></label>
            ) : null}
            {quickAddKind === "item" ? (
              <>
                <label className="text-xs font-bold text-[#405762]"><span className="mb-1.5 block">Item type</span><Select value={itemType} onValueChange={setItemType} options={[{ label: "Inventory", value: "inventory" }, { label: "Non-inventory", value: "non-inventory" }, { label: "Service", value: "service" }, { label: "Assembly", value: "assembly" }]} searchable={false}/></label>
                <label className="text-xs font-bold text-[#405762]"><span className="mb-1.5 block">Unit of measure</span><Select value={unit} onValueChange={setUnit} options={["Each", "Box", "Kg", "Liter", "Meter", "Hour"]} searchable={false}/></label>
                <label className="text-xs font-bold text-[#405762]"><span className="mb-1.5 block">Sales price</span><input type="number" min="0" step="0.0001" value={salesPrice} onChange={(event) => setSalesPrice(event.target.value)} placeholder="0.00" className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm"/></label>
                <label className="text-xs font-bold text-[#405762]"><span className="mb-1.5 block">Purchase cost</span><input type="number" min="0" step="0.0001" value={purchaseCost} onChange={(event) => setPurchaseCost(event.target.value)} placeholder="0.00" className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm"/></label>
              </>
            ) : null}
            {quickAddKind === "account" ? (
              <label className="text-xs font-bold text-[#405762]"><span className="mb-1.5 block">Account type</span><Select value={accountType} onValueChange={setAccountType} options={[{ label: "Asset", value: "asset" }, { label: "Liability", value: "liability" }, { label: "Equity", value: "equity" }, { label: "Income", value: "income" }, { label: "Expense", value: "expense" }, { label: "Cost of goods sold", value: "cost-of-goods-sold" }]} searchable={false}/></label>
            ) : null}
            {addError ? <p role="alert" className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{addError}</p> : null}
          </div>
          <div className="flex justify-end gap-2 border-t border-[#e7edf1] px-5 py-4">
            <button type="button" onClick={() => setAddModalOpen(false)} className="h-10 rounded-xl border border-[#dce6ed] px-4 text-xs font-bold text-[#526874]">Cancel</button>
            <button type="button" disabled={!newName.trim() || ((quickAddKind === "item" || quickAddKind === "account") && !newCode.trim()) || savingNew} onClick={() => void saveNewOption()} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white hover:bg-[#0069ad] disabled:cursor-not-allowed disabled:opacity-50"><Save size={14}/> {savingNew ? "Saving…" : "Save & select"}</button>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
