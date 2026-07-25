"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { z } from "zod";
import { AppShell } from "../../components/layout/app-shell";
import { Card } from "../../components/ui/card";
import { ConfirmDeleteDialog } from "../../components/ui/confirm-delete-dialog";
import { DatePicker } from "../../components/ui/date-picker";
import { Select } from "../../components/ui/select";
import { Toast, type ToastMessage } from "../../components/ui/toast";
import { cn } from "../../lib/utils";
import type { FormField, ResourceConfig } from "./resource-config";

interface LineItem {
  id: number;
  item: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
  tax: string;
}

function supportsQuickAdd(field: FormField) {
  return /(customer|vendor|account|warehouse|employee|project|salesRep|approver|payee)$/i.test(field.name);
}

function FormControl({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
}) {
  const styles =
    "h-11 w-full rounded-xl border border-[#dce6ed] bg-white px-3 text-sm text-[#29414d] outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10";

  if (field.type === "textarea") {
    return <textarea name={field.name} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`} className={cn(styles, "min-h-24 resize-y py-3")} />;
  }
  if (field.type === "select") {
    return <Select name={field.name} value={value || undefined} onValueChange={onChange} options={field.options ?? []} placeholder={`Select ${field.label.toLowerCase()}`} allowAddNew={supportsQuickAdd(field)} addNewLabel={field.label.toLowerCase()} />;
  }
  if (field.type === "date") {
    return <DatePicker name={field.name} value={value} onChange={onChange} placeholder={`Select ${field.label.toLowerCase()}`} />;
  }
  if (field.type === "checkbox") {
    return (
      <span className="flex h-11 items-center gap-2 rounded-xl border border-[#dce6ed] px-3 text-xs font-semibold text-[#536a76]">
        <input name={field.name} type="checkbox" checked={value === "true"} onChange={(event) => onChange(String(event.target.checked))} className="size-4 accent-[#007DCC]" />
        {field.label}
      </span>
    );
  }
  return <input name={field.name} type={field.type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`} className={styles} />;
}

const blankLine = (): LineItem => ({
  id: Date.now() + Math.random(),
  item: "",
  description: "",
  quantity: "1",
  unit: "Each",
  rate: "",
  tax: "Standard tax",
});

export function ResourceFormPage({ config }: { config: ResourceConfig }) {
  const router = useRouter();
  const [lineItems, setLineItems] = useState<LineItem[]>([blankLine()]);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteLineId, setDeleteLineId] = useState<number | null>(null);
  const listHref = `/${config.module}/${config.slug}`;

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = config.formSections.flatMap((section) => section.fields);
    const shape = Object.fromEntries(fields.map((field) => {
      let validator = z.string();
      if (field.type === "email") validator = validator.email("Enter a valid email address");
      if (field.required) validator = validator.min(1, `${field.label} is required`);
      return [field.name, validator];
    }));
    const result = z.object(shape).safeParse(
      Object.fromEntries(fields.map((field) => [field.name, values[field.name] ?? ""])),
    );
    if (!result.success) {
      setErrors(Object.fromEntries(result.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      setMessage({ title: "Validation failed", description: "Please correct the highlighted fields and try again.", variant: "error" });
      return;
    }
    setErrors({});
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const mode = submitter?.value === "new" ? "new" : "close";

    if (mode === "new") {
      form.reset();
      setValues({});
      setLineItems([blankLine()]);
      setMessage({ title: "Saved successfully", description: `${config.title} saved. You can add another.`, variant: "success" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    router.push(`${listHref}?saved=1`);
  };

  const lineTotal = lineItems.reduce(
    (total, line) => total + Number(line.quantity || 0) * Number(line.rate || 0),
    0,
  );

  return (
    <AppShell>
      <form onSubmit={save} className="mx-auto max-w-[1500px] pb-24">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link href={listHref} className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]">
              <ArrowLeft size={15} /> Back to {config.title.toLowerCase()}
            </Link>
            <p className="text-xs font-bold text-[#007DCC]">{config.moduleTitle}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">{config.primaryAction}</h1>
            <p className="mt-1.5 text-sm text-[#6b7e8a]">Complete the information below. Required fields are marked with an asterisk.</p>
          </div>
          <Toast message={message} onClose={() => setMessage(null)}/>
        </div>

        <div className="space-y-4">
          {config.formSections.map((section) => (
            <Card key={section.title} className="p-5 md:p-6">
              <h2 className="text-sm font-bold text-[#213b48]">{section.title}</h2>
              {section.description ? <p className="mt-1 text-xs text-[#7b8e99]">{section.description}</p> : null}
              <div className="mt-5 grid gap-4 md:grid-cols-6">
                {section.fields.map((field) => (
                  <label key={field.name} className={cn("block", field.width === "full" ? "md:col-span-6" : field.width === "third" ? "md:col-span-2" : "md:col-span-3")}>
                    {field.type !== "checkbox" ? <span className="mb-1.5 block text-xs font-bold text-[#455c68]">{field.label}{field.required ? <span className="ml-1 text-red-500">*</span> : null}</span> : null}
                    <FormControl field={field} value={values[field.name] ?? ""} onChange={(value) => setValues((current) => ({ ...current, [field.name]: value }))} />
                    {errors[field.name] ? <span className="mt-1.5 block text-[11px] font-semibold text-red-600">{errors[field.name]}</span> : null}
                  </label>
                ))}
              </div>
            </Card>
          ))}

          {config.hasLineItems ? (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-[#e5ecf1] p-5">
                <div><h2 className="text-sm font-bold text-[#213b48]">Items, quantities & pricing</h2><p className="mt-1 text-xs text-[#7b8e99]">Add products, services, accounts, tax and quantity details.</p></div>
                <button type="button" onClick={() => setLineItems((current) => [...current, blankLine()])} className="flex items-center gap-1.5 rounded-lg bg-[#eaf5fc] px-3 py-2 text-xs font-bold text-[#007DCC]"><Plus size={14}/> Add line</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px]">
                  <thead><tr className="bg-[#f8fafc]">{["Item/account","Description","Qty","U/M","Rate","Tax","Amount",""].map((heading) => <th key={heading} className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#768994]">{heading}</th>)}</tr></thead>
                  <tbody>
                    {lineItems.map((line) => {
                      const update = (key: keyof LineItem, value: string) => setLineItems((current) => current.map((item) => item.id === line.id ? { ...item, [key]: value } : item));
                      return (
                        <tr key={line.id} className="border-t border-[#edf1f4]">
                          <td className="p-2"><input value={line.item} onChange={(event) => update("item", event.target.value)} placeholder="Select item" className="h-10 w-full rounded-lg border border-[#dce6ed] px-2 text-xs"/></td>
                          <td className="p-2"><input value={line.description} onChange={(event) => update("description", event.target.value)} placeholder="Description" className="h-10 w-full rounded-lg border border-[#dce6ed] px-2 text-xs"/></td>
                          <td className="p-2"><input type="number" min="0" value={line.quantity} onChange={(event) => update("quantity", event.target.value)} className="h-10 w-20 rounded-lg border border-[#dce6ed] px-2 text-xs"/></td>
                          <td className="p-2"><Select value={line.unit} onValueChange={(value) => update("unit", value)} options={["Each","Box","Kg","Hour"]} className="h-10 text-xs"/></td>
                          <td className="p-2"><input type="number" min="0" value={line.rate} onChange={(event) => update("rate", event.target.value)} className="h-10 w-24 rounded-lg border border-[#dce6ed] px-2 text-xs"/></td>
                          <td className="p-2"><Select value={line.tax} onValueChange={(value) => update("tax", value)} options={["Standard tax","Non-taxable","Zero rated"]} className="h-10 text-xs"/></td>
                          <td className="p-2 text-xs font-bold text-[#29414d]">${(Number(line.quantity || 0) * Number(line.rate || 0)).toLocaleString()}</td>
                          <td className="p-2"><button type="button" aria-label="Delete line" disabled={lineItems.length === 1} onClick={() => setDeleteLineId(line.id)} className="rounded-lg p-2 text-red-500 disabled:opacity-30"><Trash2 size={15}/></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end border-t border-[#e5ecf1] p-5">
                <div className="w-72 space-y-2 text-xs">
                  <div className="flex justify-between text-[#647984]"><span>Subtotal</span><span>${lineTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between text-[#647984]"><span>Estimated tax</span><span>${(lineTotal * 0.05).toLocaleString()}</span></div>
                  <div className="flex justify-between border-t border-[#dfe7ed] pt-2 text-base font-bold text-[#17303d]"><span>Total</span><span>${(lineTotal * 1.05).toLocaleString()}</span></div>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#dfe7ed] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(14,42,61,0.08)] backdrop-blur lg:left-[252px] md:px-7">
          <div className="mx-auto flex max-w-[1500px] justify-end gap-2">
            <Link href={listHref} className="flex h-10 items-center rounded-xl border border-[#dce6ed] px-4 text-xs font-bold text-[#536b78]">Cancel</Link>
            <button type="submit" name="saveMode" value="new" className="flex h-10 items-center gap-2 rounded-xl border border-[#007DCC] px-4 text-xs font-bold text-[#007DCC]"><Save size={15}/> Save & new</button>
            <button type="submit" name="saveMode" value="close" className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-5 text-xs font-bold text-white hover:bg-[#0069ad]"><Save size={15}/> Save & close</button>
          </div>
        </div>
      </form>
      <ConfirmDeleteDialog
        open={deleteLineId !== null}
        title="Remove this transaction line?"
        recordName="Line item from the current transaction"
        description="The item, quantity, rate, and tax entered on this line will be removed. The transaction form will remain open."
        confirmLabel="Remove line"
        onClose={() => setDeleteLineId(null)}
        onConfirm={() => {
          if (deleteLineId === null) return;
          setLineItems((current) => current.filter((item) => item.id !== deleteLineId));
          setDeleteLineId(null);
        }}
      />
    </AppShell>
  );
}
