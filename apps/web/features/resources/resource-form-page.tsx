"use client";

import { Link } from "@/components/routing";
import { useRouter } from "@/components/routing";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, LoaderCircle, Plus, Save, Trash2 } from "lucide-react";
import {
  createDraftFormSchema,
  essentialFormFields,
  draftResourceDataSchema,
} from "@blue-plastic/types";
import { AppShell } from "../../components/layout/app-shell";
import { Card } from "../../components/ui/card";
import { ConfirmDeleteDialog } from "../../components/ui/confirm-delete-dialog";
import { DatePicker } from "../../components/ui/date-picker";
import {
  Select,
  type QuickAddInput,
  type QuickAddKind,
  type SelectOption,
} from "../../components/ui/select";
import { Toast, type ToastMessage } from "../../components/ui/toast";
import {
  cn,
  formatDecimal,
  formatDecimalInput,
  formatQuantityInput,
} from "../../lib/utils";
import { ApiError } from "../../lib/api-client";
import type { FormField, ResourceConfig } from "./resource-config";
import {
  useResourceDetail,
  useResourceList,
  useResourceMutations,
} from "./resource-api";
import { useReferenceData } from "./reference-data";
import {
  hydrateResourceFormValues,
  normalizeResourceData,
} from "./resource-field-mapping";

interface LineItem {
  id: number;
  item: string;
  description: string;
  quantity: string;
  unit: string;
  rate: string;
}

interface PaymentAllocation {
  invoiceId: string;
  amount: string;
}

function PaymentAllocationTable({
  customerId,
  allocations,
  onChange,
}: {
  customerId: string;
  allocations: PaymentAllocation[];
  onChange: (allocations: PaymentAllocation[]) => void;
}) {
  const invoices = useResourceList("sales", "invoices", {
    page: 1,
    pageSize: 200,
  });
  const openInvoices = (invoices.data?.data ?? []).filter((invoice) => {
    const balance = Number(invoice.data.balanceDue ?? 0);
    return (
      Boolean(customerId) &&
      invoice.data.customerId === customerId &&
      balance > 0 &&
      ["open", "partially_paid", "overdue"].includes(
        invoice.status.toLowerCase(),
      )
    );
  });
  const amountFor = (invoiceId: string) =>
    allocations.find((allocation) => allocation.invoiceId === invoiceId)
      ?.amount ?? "";
  const update = (invoiceId: string, amount: string) => {
    const next = allocations.filter(
      (allocation) => allocation.invoiceId !== invoiceId,
    );
    if (amount && Number(amount) > 0) next.push({ invoiceId, amount });
    onChange(next);
  };

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-[#e5ecf1] p-5">
        <h2 className="text-sm font-bold text-[#213b48]">
          Apply payment to open invoices
        </h2>
        <p className="mt-1 text-xs text-[#7b8e99]">
          Only posted invoices for the selected customer are shown.
        </p>
      </div>
      {!customerId ? (
        <p className="p-6 text-center text-xs text-[#71848f]">
          Select a customer to view their open invoices.
        </p>
      ) : invoices.isLoading ? (
        <p className="p-6 text-center text-xs text-[#71848f]">
          Loading open invoices…
        </p>
      ) : !openInvoices.length ? (
        <p className="p-6 text-center text-xs text-[#71848f]">
          This customer has no open posted invoices.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#768994]">
              <tr>
                {[
                  "Apply",
                  "Invoice",
                  "Due date",
                  "Original amount",
                  "Open balance",
                  "Payment",
                ].map((heading) => (
                  <th key={heading} className="px-5 py-3">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {openInvoices.map((invoice) => {
                const amount = amountFor(invoice.id);
                const openBalance = String(invoice.data.balanceDue ?? "0");
                return (
                  <tr key={invoice.id} className="border-t border-[#edf1f4]">
                    <td className="px-5 py-3">
                      <input
                        type="checkbox"
                        checked={Boolean(amount)}
                        onChange={(event) =>
                          update(invoice.id, event.target.checked ? openBalance : "")
                        }
                        className="size-4 accent-[#007DCC]"
                      />
                    </td>
                    <td className="px-5 py-3 font-bold text-[#007DCC]">
                      {String(invoice.data.documentNumber ?? invoice.id)}
                    </td>
                    <td className="px-5 py-3">{String(invoice.data.dueDate ?? "—")}</td>
                    <td className="px-5 py-3">${formatDecimal(String(invoice.data.total ?? "0"))}</td>
                    <td className="px-5 py-3 font-bold">${formatDecimal(openBalance)}</td>
                    <td className="px-5 py-3">
                      <input
                        aria-label={`Payment for ${String(invoice.data.documentNumber ?? invoice.id)}`}
                        type="number"
                        min="0"
                        max={openBalance}
                        step="0.0001"
                        value={amount}
                        onChange={(event) => update(invoice.id, event.target.value)}
                        className="h-9 w-28 rounded-lg border border-[#dce6ed] px-2"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function supportsQuickAdd(field: FormField) {
  return /(customer|vendor|account|warehouse|employee|project|salesRep|approver|payee)(Id)?$/i.test(
    field.name,
  );
}

function quickAddKind(field: FormField): QuickAddKind {
  if (/account/i.test(field.name)) return "account";
  if (/item|product|service/i.test(field.name)) return "item";
  if (/vendor|payee/i.test(field.name)) return "vendor";
  return "customer";
}

function FormControl({
  field,
  value,
  onChange,
  options,
  onCreateOption,
  invalid = false,
}: {
  field: FormField;
  value: string;
  onChange: (value: string) => void;
  options?: SelectOption[];
  onCreateOption?: (
    input: QuickAddInput,
  ) => Promise<{ label: string; value: string }>;
  invalid?: boolean;
}) {
  const styles = cn(
    "h-11 w-full rounded-xl border bg-white px-3 text-sm text-[#29414d] outline-none focus:ring-4",
    invalid
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-[#dce6ed] focus:border-[#007DCC] focus:ring-[#007DCC]/10",
  );

  if (field.type === "textarea") {
    return (
      <textarea
        name={field.name}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
        className={cn(styles, "min-h-24 resize-y py-3")}
      />
    );
  }
  if (field.type === "select") {
    return (
      <Select
        name={field.name}
        value={value || undefined}
        onValueChange={onChange}
        options={options ?? field.options ?? []}
        placeholder={`Select ${field.label.toLowerCase()}`}
        allowAddNew={supportsQuickAdd(field)}
        addNewLabel={field.label.toLowerCase()}
        quickAddKind={quickAddKind(field)}
        onCreateOption={onCreateOption}
        className={
          invalid
            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
            : undefined
        }
      />
    );
  }
  if (field.type === "date") {
    return (
      <DatePicker
        name={field.name}
        value={value}
        onChange={onChange}
        placeholder={`Select ${field.label.toLowerCase()}`}
        className={
          invalid
            ? "border-red-400 focus:border-red-500 focus:ring-red-100"
            : undefined
        }
      />
    );
  }
  if (field.type === "checkbox") {
    return (
      <span className="flex h-11 items-center gap-2 rounded-xl border border-[#dce6ed] px-3 text-xs font-semibold text-[#536a76]">
        <input
          name={field.name}
          type="checkbox"
          checked={value === "true"}
          onChange={(event) => onChange(String(event.target.checked))}
          className="size-4 accent-[#007DCC]"
          aria-invalid={invalid}
        />
        {field.label}
      </span>
    );
  }
  return (
    <input
      name={field.name}
      type={field.type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}`}
      className={styles}
    />
  );
}

const blankLine = (): LineItem => ({
  id: Date.now() + Math.random(),
  item: "",
  description: "",
  quantity: "1",
  unit: "Each",
  rate: "",
});

const isoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function initialValues(config: ResourceConfig) {
  const today = new Date();
  const dueDate = new Date(today);
  dueDate.setDate(dueDate.getDate() + 30);
  return Object.fromEntries(
    config.formSections
      .flatMap((section) => section.fields)
      .map((field) => {
        if (field.type === "date")
          return [
            field.name,
            /dueDate/i.test(field.name) ? isoDate(dueDate) : isoDate(today),
          ];
        if (/currency/i.test(field.name)) return [field.name, "USD"];
        if (/exchangeRate/i.test(field.name)) return [field.name, "1"];
        if (/^terms$/i.test(field.name)) return [field.name, "Net 30"];
        if (/^template$/i.test(field.name))
          return [field.name, field.options?.[0] ?? ""];
        if (/^unit$/i.test(field.name)) return [field.name, "Each"];
        if (
          config.module === "inventory" &&
          config.slug === "items" &&
          field.name === "type"
        )
          return [field.name, "inventory"];
        return [field.name, ""];
      }),
  );
}

export function ResourceFormPage({ config }: { config: ResourceConfig }) {
  const router = useRouter();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit") ?? "";
  const detail = useResourceDetail(config.module, config.slug, editId);
  const mutations = useResourceMutations(config.module, config.slug);
  const references = useReferenceData();
  const [lineItems, setLineItems] = useState<LineItem[]>([blankLine()]);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [values, setValues] = useState<Record<string, string>>(() =>
    initialValues(config),
  );
  const [paymentAllocations, setPaymentAllocations] = useState<PaymentAllocation[]>([]);
  const createIdempotencyKey = useRef(crypto.randomUUID());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteLineId, setDeleteLineId] = useState<number | null>(null);
  const [saveMode, setSaveMode] = useState<"new" | "close">("close");
  const saving = mutations.create.isPending || mutations.update.isPending;
  const listHref = `/${config.module}/${config.slug}`;
  const lineReferenceOptions =
    config.module === "accounting"
      ? references.accountOptions
      : references.itemOptions;
  // Deferred fields are already stripped from `config`; this only tidies the
  // section headings that still advertise them.
  const visibleSections = config.formSections.map((section) => ({
    ...section,
    title: section.title
      .replace(/,\s*tax/i, "")
      .replace(/tax\s*&\s*/i, "")
      .replace(/\s*&\s*shipping/i, ""),
  }));
  const allFields = visibleSections.flatMap((section) => section.fields);
  const requiredFields = essentialFormFields(allFields);

  useEffect(() => {
    const record = detail.data?.data;
    if (!editId || !record) return;
    const loaded = hydrateResourceFormValues(
      allFields.map((field) => field.name),
      record.data,
      initialValues(config),
    );
    const firstLine = Array.isArray(record.data.lines)
      ? (record.data.lines[0] as Record<string, unknown> | undefined)
      : undefined;
    setValues(
      firstLine?.warehouseId
        ? { ...loaded, warehouse: String(firstLine.warehouseId) }
        : loaded,
    );
    if (Array.isArray(record.data.lines) && record.data.lines.length) {
      setLineItems(
        record.data.lines.map((entry, index) => {
          const line = entry as Record<string, unknown>;
          return {
            id: Date.now() + index,
            item: String(line.itemId ?? line.accountId ?? ""),
            description: String(line.description ?? ""),
            quantity: formatQuantityInput(String(line.quantity ?? "1")),
            unit: String(line.unit ?? "Each"),
            rate: formatDecimalInput(
              String(line.unitPrice ?? line.rate ?? ""),
            ),
          };
        }),
      );
    } else {
      setLineItems([blankLine()]);
    }
    setPaymentAllocations(
      Array.isArray(record.data.allocations)
        ? (record.data.allocations as Array<Record<string, unknown>>).map(
            (allocation) => ({
              invoiceId: String(allocation.invoiceId ?? ""),
              amount: String(allocation.amount ?? ""),
            }),
          ).filter((allocation) => allocation.invoiceId && allocation.amount)
        : [],
    );
    setErrors({});
  }, [editId, detail.data, config]);

  useEffect(() => {
    if (editId) return;
    setValues((current) => {
      const next = { ...current };
      for (const field of allFields) {
        if (!/account/i.test(field.name) || next[field.name]) continue;
        const option = references.accountOptionsFor(field.name)[0];
        if (option && typeof option !== "string")
          next[field.name] = option.value;
      }
      return next;
    });
  }, [editId, references.accountOptions, config.module, config.slug]);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = allFields;
    const result = createDraftFormSchema(fields).safeParse(
      Object.fromEntries(
        fields.map((field) => [field.name, values[field.name] ?? ""]),
      ),
    );
    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      setMessage({
        title: "Validation failed",
        description: "Please correct the highlighted fields and try again.",
        variant: "error",
      });
      return;
    }
    setErrors({});
    const data: Record<string, unknown> = normalizeResourceData(
      Object.fromEntries(
        Object.entries(values).filter(([, value]) => value !== ""),
      ),
    );
    for (const field of fields) {
      if (field.type === "checkbox")
        data[field.name] = values[field.name] === "true";
    }
    if (config.hasLineItems) {
      const completedLines = lineItems.filter((line) => line.item);
      if (!completedLines.length) {
        setMessage({
          title: "Item required",
          description:
            "Select at least one item or account before saving this transaction.",
          variant: "error",
        });
        return;
      }
      data.lines = completedLines.map((line) => ({
        ...(config.module === "accounting"
          ? { accountId: line.item }
          : { itemId: line.item }),
        description: line.description || line.item || "Transaction line",
        quantity: line.quantity || "1",
        unitPrice: line.rate || "0",
        discountAmount: "0",
        unit: line.unit,
      }));
      if (config.module === "sales" && config.slug === "invoices") {
        const warehouseId = values.warehouse || "";
        if (warehouseId)
          data.lines = (data.lines as Array<Record<string, unknown>>).map(
            (line) => ({ ...line, warehouseId }),
          );
        delete data.warehouse;
        delete data.warehouseId;
        // Totals are calculated by the API, so the browser never sends them.
        delete data.subtotal;
        delete data.total;
        delete data.balanceDue;
      } else {
        data.subtotal = lineTotal.toFixed(4);
        data.total = lineTotal.toFixed(4);
        data.balanceDue = lineTotal.toFixed(4);
      }
    }
    if (config.module === "sales" && config.slug === "payments")
      data.allocations = paymentAllocations;
    if (!data.currency) data.currency = references.baseCurrency;
    const draftResult = draftResourceDataSchema.safeParse(data);
    if (!draftResult.success) {
      setMessage({
        title: "Invalid form data",
        description: "The form contains a value that cannot be saved.",
        variant: "error",
      });
      console.error("[FORM_CONTRACT_ERROR]", {
        module: config.module,
        resource: config.slug,
        issues: draftResult.error.issues,
      });
      return;
    }
    try {
      if (editId && detail.data?.data) {
        await mutations.update.mutateAsync({
          id: editId,
          data,
          version: detail.data.data.version,
        });
      } else {
        await mutations.create.mutateAsync({
          data,
          status:
            config.module === "sales" &&
            ["invoices", "payments"].includes(config.slug)
              ? "draft"
              : "incomplete",
          idempotencyKey: createIdempotencyKey.current,
        });
      }
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        caught.details &&
        typeof caught.details === "object"
      ) {
        const fieldErrors = (
          caught.details as { fieldErrors?: Record<string, string[]> }
        ).fieldErrors;
        if (fieldErrors)
          setErrors(
            Object.fromEntries(
              Object.entries(fieldErrors).map(([field, messages]) => [
                field,
                messages[0] ?? "Invalid value",
              ]),
            ),
          );
      }
      setMessage({
        title: "Unable to save",
        description:
          caught instanceof Error
            ? caught.message
            : "The API rejected this record.",
        variant: "error",
      });
      return;
    }

    if (saveMode === "new") {
      form.reset();
      setValues(initialValues(config));
      setLineItems([blankLine()]);
      setPaymentAllocations([]);
      createIdempotencyKey.current = crypto.randomUUID();
      setMessage({
        title: "Saved successfully",
        description: `${config.title} saved. You can add another.`,
        variant: "success",
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    router.push(`${listHref}?saved=1`);
  };

  const lineTotal = lineItems.reduce(
    (total, line) =>
      total + Number(line.quantity || 0) * Number(line.rate || 0),
    0,
  );

  return (
    <AppShell>
      <form onSubmit={save} className="mx-auto max-w-[1500px] pb-24">
        <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link
              href={listHref}
              className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={15} /> Back to {config.title.toLowerCase()}
            </Link>
            <p className="text-xs font-bold text-[#007DCC]">
              {config.moduleTitle}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">
              {config.primaryAction}
            </h1>
            <p className="mt-1.5 text-sm text-[#6b7e8a]">
              Complete the information below. Required fields are marked with an
              asterisk.
            </p>
          </div>
          <Toast message={message} onClose={() => setMessage(null)} />
        </div>

        <div className="space-y-4">
          {visibleSections.map((section, sectionIndex) => (
            <Card
              key={section.title}
              className={cn(
                "overflow-visible border-[#cfdce4] p-0 shadow-sm",
                config.module === "sales" &&
                  config.slug === "invoices" &&
                  sectionIndex === 0 &&
                  "border-[#537b9d]",
              )}
            >
              <div
                className={cn(
                  "rounded-t-2xl border-b border-[#cfdce4] bg-[#f6f9fb] px-5 py-3 md:px-5",
                  config.module === "sales" &&
                    config.slug === "invoices" &&
                    sectionIndex === 0 &&
                    "border-[#537b9d] bg-[#6689a8] text-white",
                )}
              >
                <h2
                  className={cn(
                    "text-sm font-bold",
                    config.module === "sales" &&
                      config.slug === "invoices" &&
                      sectionIndex === 0
                      ? "text-white"
                      : "text-[#213b48]",
                  )}
                >
                  {section.title}
                </h2>
                {section.description ? (
                  <p className="mt-1 text-xs text-[#7b8e99]">
                    {section.description}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-3 p-4 md:grid-cols-6 md:p-5">
                {section.fields.map((field) => (
                  <label
                    key={field.name}
                    className={cn(
                      "block",
                      field.width === "full"
                        ? "md:col-span-6"
                        : field.width === "third"
                          ? "md:col-span-2"
                          : "md:col-span-3",
                    )}
                  >
                    {field.type !== "checkbox" ? (
                      <span
                        className={cn(
                          "mb-1.5 block text-xs font-medium",
                          errors[field.name]
                            ? "text-red-700"
                            : "text-[#455c68]",
                        )}
                      >
                        {field.label}
                        {requiredFields.has(field.name) ||
                        errors[field.name] ? (
                          <span className="ml-1 text-red-500">*</span>
                        ) : null}
                      </span>
                    ) : null}
                    <FormControl
                      field={field}
                      value={values[field.name] ?? ""}
                      onChange={(value) => {
                        setValues((current) => ({
                          ...current,
                          [field.name]: value,
                        }));
                        setErrors((current) => {
                          if (!current[field.name]) return current;
                          const next = { ...current };
                          delete next[field.name];
                          return next;
                        });
                      }}
                      options={references.optionsFor(field)}
                      onCreateOption={references.createOption}
                      invalid={Boolean(errors[field.name])}
                    />
                    {errors[field.name] ? (
                      <span className="mt-1.5 block text-[11px] font-semibold text-red-600">
                        {errors[field.name]}
                      </span>
                    ) : null}
                  </label>
                ))}
              </div>
            </Card>
          ))}

          {config.hasLineItems ? (
            <Card className="overflow-visible border-[#cfdce4]">
              <div className="flex items-center justify-between border-b border-[#cfdce4] bg-[#f6f9fb] px-4 py-3">
                <div>
                  <h2 className="text-sm font-bold text-[#213b48]">
                    Items, quantities & pricing
                  </h2>
                  <p className="mt-1 text-xs text-[#7b8e99]">
                    Select an item to fill its description, unit and sales price
                    automatically.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setLineItems((current) => [...current, blankLine()])
                  }
                  className="flex items-center gap-1.5 rounded-lg bg-[#eaf5fc] px-3 py-2 text-xs font-bold text-[#007DCC]"
                >
                  <Plus size={14} /> Add line
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] table-fixed">
                  <colgroup>
                    <col className="w-[30%]" />
                    <col className="w-[29%]" />
                    <col className="w-[9%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[9%]" />
                    <col className="w-[3%]" />
                  </colgroup>
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      {[
                        "Item / account name",
                        "Description",
                        "Qty",
                        "U/M",
                        "Rate",
                        "Amount",
                        "",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#768994]"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((line) => {
                      const update = (key: keyof LineItem, value: string) =>
                        setLineItems((current) =>
                          current.map((item) =>
                            item.id === line.id
                              ? { ...item, [key]: value }
                              : item,
                          ),
                        );
                      const selectLineReference = (value: string) => {
                        if (config.module === "accounting") {
                          update("item", value);
                          return;
                        }
                        const item = references.itemById.get(value);
                        setLineItems((current) =>
                          current.map((entry) =>
                            entry.id === line.id
                              ? {
                                  ...entry,
                                  item: value,
                                  description: String(
                                    item?.data.salesDescription ??
                                      item?.data.description ??
                                      item?.data.name ??
                                      entry.description,
                                  ),
                                  unit: String(item?.data.unit ?? entry.unit),
                                  rate: formatDecimalInput(
                                    String(item?.data.salesPrice ?? entry.rate),
                                  ),
                                }
                              : entry,
                          ),
                        );
                      };
                      return (
                        <tr
                          key={line.id}
                          className="border-t border-[#d9e3ea] odd:bg-white even:bg-[#edf5fb]"
                        >
                          <td className="p-1.5">
                            <Select
                              value={line.item || undefined}
                              onValueChange={selectLineReference}
                              options={lineReferenceOptions}
                              placeholder={
                                config.module === "accounting"
                                  ? "Select account"
                                  : "Select item"
                              }
                              allowAddNew
                              addNewLabel={
                                config.module === "accounting"
                                  ? "account"
                                  : "item"
                              }
                              quickAddKind={
                                config.module === "accounting"
                                  ? "account"
                                  : "item"
                              }
                              onCreateOption={references.createOption}
                              onOptionCreated={(_, input) => {
                                if (input.kind !== "item") return;
                                setLineItems((current) =>
                                  current.map((entry) =>
                                    entry.id === line.id
                                      ? {
                                          ...entry,
                                          description: input.name,
                                          unit: input.unit,
                                          rate: formatDecimalInput(
                                            input.salesPrice || "0",
                                          ),
                                        }
                                      : entry,
                                  ),
                                );
                              }}
                              className="h-9 rounded-md border-[#aebfca] px-3 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              value={line.description}
                              onChange={(event) =>
                                update("description", event.target.value)
                              }
                              placeholder="Description"
                              className="h-9 w-full rounded-md border border-[#aebfca] bg-transparent px-2 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={line.quantity}
                              onChange={(event) =>
                                update("quantity", event.target.value)
                              }
                              onBlur={(event) =>
                                update(
                                  "quantity",
                                  formatQuantityInput(event.target.value),
                                )
                              }
                              step="any"
                              className="h-9 w-full rounded-md border border-[#aebfca] bg-transparent px-2 text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <Select
                              value={line.unit}
                              onValueChange={(value) => update("unit", value)}
                              options={["Each", "Box", "Kg", "Hour"]}
                              className="h-9 rounded-md border-[#aebfca] text-xs"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min="0"
                              value={line.rate}
                              onChange={(event) =>
                                update("rate", event.target.value)
                              }
                              onBlur={(event) =>
                                update(
                                  "rate",
                                  formatDecimalInput(event.target.value),
                                )
                              }
                              step="any"
                              className="h-9 w-full rounded-md border border-[#aebfca] bg-transparent px-2 text-xs"
                            />
                          </td>
                          <td className="p-2 text-xs font-bold text-[#29414d]">
                            $
                            {formatDecimal(
                              Number(line.quantity || 0) *
                                Number(line.rate || 0),
                            )}
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              aria-label="Delete line"
                              disabled={lineItems.length === 1}
                              onClick={() => setDeleteLineId(line.id)}
                              className="rounded-lg p-2 text-red-500 disabled:opacity-30"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end border-t border-[#e5ecf1] p-5">
                <div className="w-72 space-y-2 text-xs">
                  <div className="flex justify-between text-[#647984]">
                    <span>
                      {config.module === "sales" && config.slug === "invoices"
                        ? "Items subtotal (estimate)"
                        : "Subtotal"}
                    </span>
                    <span>${formatDecimal(lineTotal)}</span>
                  </div>
                  {config.module === "sales" && config.slug === "invoices" ? (
                    <p className="border-t border-[#dfe7ed] pt-2 text-[10px] leading-4 text-[#71848f]">
                      The API calculates and returns the authoritative total
                      after validating every line.
                    </p>
                  ) : (
                    <div className="flex justify-between border-t border-[#dfe7ed] pt-2 text-base font-bold text-[#17303d]">
                      <span>Total</span>
                      <span>${formatDecimal(lineTotal)}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ) : null}

          {config.module === "sales" && config.slug === "payments" ? (
            <PaymentAllocationTable
              customerId={values.customer ?? values.customerId ?? ""}
              allocations={paymentAllocations}
              onChange={setPaymentAllocations}
            />
          ) : null}

          {config.module === "sales" && config.slug === "deposits" ? (
            <Card className="overflow-hidden">
              <div className="border-b border-[#e5ecf1] p-5">
                <h2 className="text-sm font-bold text-[#213b48]">
                  Undeposited payments
                </h2>
                <p className="mt-1 text-xs text-[#7b8e99]">
                  The selected total must match the physical or electronic bank
                  deposit.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-xs">
                  <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#768994]">
                    <tr>
                      {[
                        "Select",
                        "Payment",
                        "Customer",
                        "Method",
                        "Reference",
                        "Amount",
                      ].map((heading) => (
                        <th key={heading} className="px-5 py-3">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      [
                        "PAY-1048",
                        "Banaadir Trading Co.",
                        "Bank transfer",
                        "REF-6842",
                        "$8,420.00",
                      ],
                      [
                        "SR-1047",
                        "Walk-in customer",
                        "Cash",
                        "POS-4821",
                        "$1,240.00",
                      ],
                      [
                        "PAY-1046",
                        "Horn Logistics",
                        "Cheque",
                        "CHQ-0291",
                        "$3,180.00",
                      ],
                    ].map((payment) => (
                      <tr
                        key={payment[0]}
                        className="border-t border-[#edf1f4]"
                      >
                        {payment.map((value, index) =>
                          index === 0 ? (
                            <td key={value} className="px-5 py-3">
                              <input
                                type="checkbox"
                                defaultChecked
                                className="size-4 accent-[#007DCC]"
                              />
                            </td>
                          ) : (
                            <td
                              key={value}
                              className={`px-5 py-3 ${index === 1 || index === 5 ? "font-bold" : ""}`}
                            >
                              {value}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end border-t border-[#e5ecf1] bg-[#f8fafc] p-4">
                <div className="text-right">
                  <p className="text-[10px] uppercase text-[#7b8e99]">
                    Selected deposit total
                  </p>
                  <p className="mt-1 text-xl font-bold text-[#17303d]">
                    $12,840.00
                  </p>
                </div>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[#dfe7ed] bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(14,42,61,0.08)] backdrop-blur md:px-7">
          <div className="mx-auto flex max-w-[1500px] justify-end gap-2">
            <Link
              href={listHref}
              className="flex h-10 items-center rounded-xl border border-[#dce6ed] px-4 text-xs font-bold text-[#536b78]"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              onClick={() => setSaveMode("new")}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#007DCC] px-4 text-xs font-medium text-[#007DCC] disabled:cursor-wait disabled:opacity-60"
            >
              {saving && saveMode === "new" ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}{" "}
              {saving && saveMode === "new" ? "Saving…" : "Save & new"}
            </button>
            <button
              type="submit"
              disabled={saving}
              onClick={() => setSaveMode("close")}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-5 text-xs font-medium text-white hover:bg-[#0069ad] disabled:cursor-wait disabled:opacity-60"
            >
              {saving && saveMode === "close" ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Save size={15} />
              )}{" "}
              {saving && saveMode === "close" ? "Saving…" : "Save & close"}
            </button>
          </div>
        </div>
      </form>
      <ConfirmDeleteDialog
        open={deleteLineId !== null}
        title="Remove this transaction line?"
        recordName="Line item from the current transaction"
        description="The item, quantity, and rate entered on this line will be removed. The transaction form will remain open."
        confirmLabel="Remove line"
        onClose={() => setDeleteLineId(null)}
        onConfirm={() => {
          if (deleteLineId === null) return;
          setLineItems((current) =>
            current.filter((item) => item.id !== deleteLineId),
          );
          setDeleteLineId(null);
        }}
      />
    </AppShell>
  );
}
