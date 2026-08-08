"use client";

import { Link } from "@/components/routing";
import { useRouter } from "@/components/routing";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  FileText,
  LoaderCircle,
  Pencil,
  Printer,
  RefreshCcw,
  Trash2,
} from "lucide-react";
import { AppShell } from "../../components/layout/app-shell";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { ConfirmDeleteDialog } from "../../components/ui/confirm-delete-dialog";
import { Skeleton } from "../../components/ui/skeleton";
import {
  Toast,
  type ToastMessage,
  type ToastVariant,
} from "../../components/ui/toast";
import type {
  ActivityMetric,
  ActivityRow,
  RecordActivity,
} from "@blue-plastic/types";
import type { FormField, ResourceConfig, ResourceRow } from "./resource-config";
import { InvoicePreviewDialog } from "../sales/components/invoice-preview-dialog";
import { buildDocumentPreview } from "../sales/domain/document-preview";
import type { SalesResource } from "../sales/domain/sales-record";
import { salesService } from "../sales/services/sales-service";
import {
  recordIdentifier,
  recordTitle,
  useRecordActivity,
  useResourceDetail,
  useResourceList,
  useResourceMutations,
} from "./resource-api";
import { apiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import { useReferenceData } from "./reference-data";
import { resourceFieldValue } from "./resource-field-mapping";
import { cn, formatDecimal } from "../../lib/utils";

const statusVariant = (status: string) => {
  if (["Paid", "Posted", "Active", "Approved", "Completed"].includes(status))
    return "success";
  if (["Overdue", "Rejected", "Low stock"].includes(status)) return "danger";
  if (["Pending", "Open", "Partially paid"].includes(status)) return "warning";
  return "neutral";
};

/**
 * Figures worth putting at the top of a document. Anything not listed stays in
 * its section below, so the header cannot fill up with incidental form fields.
 */
const documentHighlights = [
  "customerName",
  "vendorName",
  "payee",
  "total",
  "amount",
  "balanceDue",
  "invoiceDate",
  "billDate",
  "paymentDate",
  "saleDate",
  "dueDate",
];

const metricLabels: Record<string, string> = {
  openBalance: "Open balance",
  overdueBalance: "Overdue",
  openInvoices: "Open invoices",
  openBills: "Unpaid bills",
  lastInvoiceDate: "Last invoice",
  lastBillDate: "Last bill",
  quantityOnHand: "On hand",
  inventoryValue: "Stock value",
  averageCost: "Average cost",
  balance: "Balance",
  debitTotal: "Total debits",
  creditTotal: "Total credits",
};

/**
 * Setup-only form figures that must not compete with the live balances the
 * activity panel already shows (Open balance, On hand, …).
 */
const detailHiddenFields = new Set([
  "openingBalance",
  "asOf",
  "openingQuantity",
]);

function fieldLabel(name: string) {
  return name
    .replace(/Id$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase());
}

function summaryFields(data: Record<string, unknown>) {
  return documentHighlights
    .filter(
      (key) =>
        data[key] !== undefined &&
        data[key] !== null &&
        data[key] !== "" &&
        typeof data[key] !== "object",
    )
    .slice(0, 4)
    .map((key) => [key, data[key]] as const);
}

function metricValue(metric: ActivityMetric, currency: string) {
  if (metric.value === "\u2014") return "\u2014";
  if (metric.format === "money")
    return `${currency} ${formatDecimal(metric.value)}`;
  if (metric.format === "quantity") return formatDecimal(metric.value);
  return metric.value;
}

interface RegisterColumn {
  label: string;
  numeric?: boolean;
  /** Column that carries the link to the document behind the row. */
  link?: boolean;
}

const registerColumns: Record<string, RegisterColumn[]> = {
  customer: [
    { label: "Date" },
    { label: "Type" },
    { label: "Reference", link: true },
    { label: "Status" },
    { label: "Amount", numeric: true },
    { label: "Balance", numeric: true },
  ],
  vendor: [
    { label: "Date" },
    { label: "Type" },
    { label: "Reference", link: true },
    { label: "Status" },
    { label: "Amount", numeric: true },
    { label: "Balance", numeric: true },
  ],
  item: [
    { label: "Date" },
    { label: "Movement" },
    { label: "Source", link: true },
    { label: "Quantity", numeric: true },
    { label: "Unit cost", numeric: true },
    { label: "On hand", numeric: true },
  ],
  account: [
    { label: "Date" },
    { label: "Journal", link: true },
    { label: "Description" },
    { label: "Debit", numeric: true },
    { label: "Credit", numeric: true },
    { label: "Balance", numeric: true },
  ],
};

const registerTitles: Record<string, string> = {
  customer: "Customer transactions",
  vendor: "Vendor transactions",
  item: "Stock movements",
  account: "Account register",
};

const money = (value: string | undefined) =>
  value === undefined ? "\u2014" : formatDecimal(value);

function registerCells(row: ActivityRow, kind: string) {
  if (kind === "item")
    return [
      row.date,
      row.description,
      row.reference,
      formatDecimal(row.quantity ?? "0"),
      money(row.unitCost),
      formatDecimal(row.running ?? "0"),
    ];
  if (kind === "account")
    return [
      row.date,
      row.reference,
      row.description,
      money(row.debit),
      money(row.credit),
      money(row.running),
    ];
  return [
    row.date,
    row.kind,
    row.reference,
    row.status ?? "\u2014",
    money(row.amount),
    money(row.running),
  ];
}

/**
 * The documents behind a balance: invoices and payments for a customer, stock
 * movements for an item, posted journal lines for an account. Every figure in
 * here is calculated by the API from the ledger and the subledgers.
 */
function RegisterCard({
  activity,
  isLoading,
}: {
  activity?: RecordActivity;
  isLoading: boolean;
}) {
  if (isLoading)
    return (
      <Card className="space-y-3 p-5">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-24 w-full" />
      </Card>
    );
  if (!activity || activity.kind === "none") return null;
  const columns = registerColumns[activity.kind] ?? [];
  return (
    <>
      {activity.metrics.length ? (
        <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {activity.metrics.map((metric) => (
            <div key={metric.key}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[#81929c]">
                {metricLabels[metric.key] ?? fieldLabel(metric.key)}
              </p>
              <p className="mt-1.5 text-sm font-bold text-[#29424e]">
                {metricValue(metric, activity.currency)}
              </p>
            </div>
          ))}
        </Card>
      ) : null}
      <Card className="overflow-hidden">
        <div className="border-b border-[#e8eef2] px-5 py-4">
          <h2 className="text-sm font-bold text-[#263f4b]">
            {registerTitles[activity.kind] ?? "Transactions"}
          </h2>
          <p className="mt-1 text-xs text-[#7b8d97]">
            Documents that moved this record, newest first.
          </p>
        </div>
        {activity.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#7b8e98]">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.label}
                      className={cn("px-5 py-3", column.numeric && "text-right")}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.rows.map((row) => {
                  const cells = registerCells(row, activity.kind);
                  return (
                    <tr key={row.id} className="border-t border-[#edf1f4]">
                      {cells.map((cell, index) => (
                        <td
                          key={`${row.id}-${index}`}
                          className={cn(
                            "px-5 py-3",
                            columns[index]?.numeric
                              ? "text-right tabular-nums font-semibold text-[#29424e]"
                              : "text-[#546b77]",
                          )}
                        >
                          {columns[index]?.link && row.source ? (
                            <Link
                              href={`/${row.source.module}/${row.source.resource}/${encodeURIComponent(row.source.id)}`}
                              className="font-bold text-[#007DCC]"
                            >
                              {cell}
                            </Link>
                          ) : (
                            cell
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-5 py-10 text-center text-xs font-semibold text-[#71848f]">
            No transactions yet.
          </p>
        )}
      </Card>
    </>
  );
}

function displayValue(
  field: FormField,
  data: Record<string, unknown>,
  resolveReference: (value: unknown) => string,
) {
  const actual = resourceFieldValue(field.name, data);
  if (actual !== undefined && actual !== null) {
    if (typeof actual === "boolean") return actual ? "Yes" : "No";
    if (Array.isArray(actual))
      return `${actual.length} record${actual.length === 1 ? "" : "s"}`;
    if (typeof actual === "object") return JSON.stringify(actual, null, 2);
    if (
      field.type === "number" &&
      (typeof actual === "number" ||
        (typeof actual === "string" && /^-?\d+(\.\d+)?$/.test(actual)))
    )
      return formatDecimal(actual);
    if (
      /(Id$)|customer|vendor|project|employee|warehouse|account|item|bankAccount|paymentAccount|depositTo/i.test(
        field.name,
      )
    )
      return resolveReference(actual);
    return String(actual);
  }
  return "—";
}

const totalRows: Array<{ key: string; label: string; strong?: boolean }> = [
  { key: "subtotal", label: "Subtotal" },
  { key: "discountTotal", label: "Discount" },
  { key: "taxTotal", label: "Tax" },
  { key: "total", label: "Total", strong: true },
  { key: "amountPaid", label: "Paid" },
  { key: "balanceDue", label: "Balance due", strong: true },
];

/**
 * Server-owned invoice figures: totals, the journal entry the posting created,
 * the stock it moved, and who changed what.
 */
function InvoiceAccountingPanels({ data }: { data: Record<string, unknown> }) {
  const movements = Array.isArray(data.inventoryMovements)
    ? (data.inventoryMovements as Array<Record<string, unknown>>)
    : [];
  const history = Array.isArray(data.auditHistory)
    ? (data.auditHistory as Array<Record<string, unknown>>)
    : [];
  const currency = String(data.currency ?? "USD");

  return (
    <>
      <Card className="overflow-hidden">
        <div className="border-b border-[#e8eef2] px-5 py-4">
          <h2 className="text-sm font-bold text-[#263f4b]">
            Totals & accounting
          </h2>
          <p className="mt-1 text-xs text-[#7b8d97]">
            Calculated and stored by the server when the invoice was saved.
          </p>
        </div>
        <div className="grid gap-6 p-5 md:grid-cols-2">
          <dl className="space-y-2 text-xs">
            {totalRows.map((totalRow) => (
              <div
                key={totalRow.key}
                className={cn(
                  "flex justify-between",
                  totalRow.strong
                    ? "border-t border-[#e8eef2] pt-2 text-sm font-bold text-[#17303d]"
                    : "text-[#647984]",
                )}
              >
                <dt>{totalRow.label}</dt>
                <dd>
                  {currency} {formatDecimal(String(data[totalRow.key] ?? "0"))}
                </dd>
              </div>
            ))}
          </dl>
          <dl className="space-y-3 text-xs">
            {[
              ["Journal entry", data.postingTransactionNumber ?? data.postingTransactionId],
              ["Reversal entry", data.reversalTransactionId],
              ["Posted at", data.postedAt],
              ["Voided at", data.voidedAt],
              ["Void reason", data.voidReason],
            ]
              .filter(([, value]) => value !== undefined && value !== null && value !== "")
              .map(([label, value]) => (
                <div key={String(label)} className="flex justify-between gap-4">
                  <dt className="text-[#81929c]">{String(label)}</dt>
                  <dd className="truncate font-semibold text-[#304954]">
                    {String(value)}
                  </dd>
                </div>
              ))}
            {!data.postingTransactionId ? (
              <p className="text-[#7b8d97]">
                This draft has not affected the general ledger yet.
              </p>
            ) : null}
          </dl>
        </div>
      </Card>

      {movements.length ? (
        <Card className="overflow-hidden">
          <div className="border-b border-[#e8eef2] px-5 py-4">
            <h2 className="text-sm font-bold text-[#263f4b]">
              Inventory movements
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#7b8e98]">
                <tr>
                  {["Date", "Direction", "Quantity", "Unit cost", "Total cost"].map(
                    (heading) => (
                      <th key={heading} className="px-5 py-3">
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {movements.map((movement, index) => (
                  <tr key={index} className="border-t border-[#edf1f4]">
                    <td className="px-5 py-3">
                      {String(movement.movementDate ?? "—")}
                    </td>
                    <td className="px-5 py-3 capitalize">
                      {String(movement.direction ?? "out")}
                    </td>
                    <td className="px-5 py-3">
                      {formatDecimal(String(movement.quantity ?? "0"))}
                    </td>
                    <td className="px-5 py-3">
                      {formatDecimal(String(movement.unitCost ?? "0"))}
                    </td>
                    <td className="px-5 py-3 font-bold">
                      {formatDecimal(String(movement.totalCost ?? "0"))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {history.length ? (
        <Card className="overflow-hidden">
          <div className="border-b border-[#e8eef2] px-5 py-4">
            <h2 className="text-sm font-bold text-[#263f4b]">Audit history</h2>
          </div>
          <ol className="divide-y divide-[#edf1f4]">
            {history.map((event, index) => (
              <li key={index} className="flex gap-3 px-5 py-4">
                <CheckCircle2 size={16} className="mt-0.5 text-emerald-500" />
                <div>
                  <p className="text-xs font-bold capitalize text-[#405762]">
                    {String(event.action ?? "changed")}
                  </p>
                  <p className="mt-1 text-[10px] text-[#82949e]">
                    {String(event.occurredAt ?? "").slice(0, 19).replace("T", " ")}
                    {event.userId ? ` · ${String(event.userId)}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      ) : null}
    </>
  );
}

function PaymentSettlementPanel({ data }: { data: Record<string, unknown> }) {
  const invoices = useResourceList("sales", "invoices", { page: 1, pageSize: 200 });
  const allocations = Array.isArray(data.allocations)
    ? data.allocations as Array<Record<string, unknown>>
    : [];
  const invoiceNames = new Map(
    (invoices.data?.data ?? []).map((invoice) => [invoice.id, recordIdentifier(invoice)]),
  );
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#e8eef2] px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-[#263f4b]">Invoice allocations</h2>
          <p className="mt-1 text-xs text-[#7b8d97]">Settlement recorded by the relational payment ledger.</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase text-[#81929c]">Unapplied</p>
          <p className="mt-1 text-sm font-bold tabular-nums text-[#29424e]">
            {formatDecimal(String(data.unappliedAmount ?? data.amount ?? "0"))}
          </p>
        </div>
      </div>
      {allocations.length ? (
        <table className="w-full text-left text-xs">
          <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#7b8e98]">
            <tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3 text-right">Applied</th></tr>
          </thead>
          <tbody>
            {allocations.map((allocation, index) => {
              const invoiceId = String(allocation.invoiceId ?? "");
              return (
                <tr key={`${invoiceId}-${index}`} className="border-t border-[#edf1f4]">
                  <td className="px-5 py-3 font-bold text-[#007DCC]">
                    {invoiceNames.get(invoiceId) ?? invoiceId}
                  </td>
                  <td className="px-5 py-3 text-right font-bold tabular-nums">
                    {formatDecimal(String(allocation.amount ?? "0"))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="px-5 py-8 text-center text-xs text-[#7b8d97]">This payment is fully unapplied.</p>
      )}
    </Card>
  );
}

export function ResourceDetailsPage({
  config,
  id,
}: {
  config: ResourceConfig;
  id: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const detail = useResourceDetail(config.module, config.slug, id);
  const activity = useRecordActivity(config.module, config.slug, id);
  const mutations = useResourceMutations(config.module, config.slug);
  const references = useReferenceData();
  const record = detail.data?.data;
  const isInvoice = config.module === "sales" && config.slug === "invoices";
  const isCustomerPayment = config.module === "sales" && config.slug === "payments";
  const row: ResourceRow = record
    ? {
        id: record.id,
        displayId: recordIdentifier(record),
        status: record.status,
        cells: [
          recordTitle(record),
          String(
            record.data.amount ??
              record.data.outstanding ??
              record.data.cost ??
              "—",
          ),
          String(
            Object.entries(record.data).find(([key]) =>
              /date/i.test(key),
            )?.[1] ?? record.createdAt.slice(0, 10),
          ),
        ],
      }
    : {
        id,
        displayId: "Loading…",
        status: "Loading",
        cells: ["Loading…", "—", "—"],
      };
  const displayId = row.displayId ?? row.cells[0] ?? "Record";
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reverseOpen, setReverseOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const listHref = `/${config.module}/${config.slug}`;
  const notify = (
    title: string,
    variant: ToastVariant = "info",
    description?: string,
  ) => {
    setMessage({ title, variant, description });
    window.setTimeout(() => setMessage(null), 3200);
  };
  const runAction = async (
    path: string,
    body: Record<string, unknown> | undefined,
    successTitle: string,
    description: string,
    idempotencyKey?: string,
  ) => {
    if (actionPending) return false;
    setActionPending(true);
    try {
      await apiClient.action(path, body, "POST", idempotencyKey);
      await detail.refetch();
      await activity.refetch();
      await queryClient.invalidateQueries({
        queryKey: queryKeys.resource(config.module, config.slug),
      });
      if (isCustomerPayment) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.resource("sales", "invoices") }),
          queryClient.invalidateQueries({ queryKey: queryKeys.resource("sales", "customers") }),
        ]);
      }
      notify(successTitle, "success", description);
      return true;
    } catch (caught) {
      notify(
        "Action failed",
        "error",
        caught instanceof Error
          ? caught.message
          : "The API rejected this action.",
      );
      return false;
    } finally {
      setActionPending(false);
    }
  };

  if (detail.isLoading)
    return (
      <AppShell>
        <div className="mx-auto max-w-[1500px]">
          <Link
            href={listHref}
            className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
          >
            <ArrowLeft size={15} /> Back to {config.title.toLowerCase()}
          </Link>
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-52" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
            <Card className="space-y-5 p-5">
              <h2 className="text-sm font-semibold text-[#263f4b]">
                {config.title} information
              </h2>
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="grid grid-cols-[140px_1fr] gap-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </Card>
            <Card className="space-y-4 p-5">
              <h2 className="text-sm font-semibold text-[#263f4b]">Activity</h2>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </Card>
          </div>
        </div>
      </AppShell>
    );
  if (detail.isError || !record)
    return (
      <AppShell>
        <div className="p-12 text-center text-sm font-semibold text-red-600">
          {detail.error instanceof Error
            ? detail.error.message
            : "Record not found"}
        </div>
      </AppShell>
    );

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <Link
              href={listHref}
              className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-[#007DCC]"
            >
              <ArrowLeft size={15} /> Back to {config.title.toLowerCase()}
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">
                {displayId}
              </h1>
              <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-[#526a76]">
              {row.cells[0]}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                config.module === "sales"
                  ? setPreviewOpen(true)
                  : window.print()
              }
              className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3.5 text-xs font-bold text-[#425966]"
            >
              <Printer size={15} />{" "}
              {config.module === "sales" ? "Preview" : "Print"}
            </button>
            {!isCustomerPayment || row.status.toLowerCase() === "draft" ? <Link
              href={`${listHref}/new?edit=${encodeURIComponent(row.id)}`}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white"
            >
              <Pencil size={15} /> Edit
            </Link> : null}
          </div>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_340px]">
          <div className="space-y-4">
            {summaryFields(record.data).length ? (
            <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {summaryFields(record.data).map(([key, value]) => (
                <div key={key}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#81929c]">
                    {fieldLabel(key)}
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-[#29424e]">
                    {/Id$|Account$|^bankAccount$|^paymentAccount$|^depositTo$/i.test(
                      key,
                    )
                      ? references.resolve(value)
                      : /amount|total|balance|price|cost|debit|credit|rate/i.test(
                            key,
                          ) && /^-?\d+(\.\d+)?$/.test(String(value))
                        ? formatDecimal(String(value))
                        : String(value)}
                  </p>
                </div>
              ))}
            </Card>
            ) : null}

            {config.formSections.map((section) => {
              const populated = section.fields.filter((field) => {
                if (detailHiddenFields.has(field.name)) return false;
                return (
                  resourceFieldValue(field.name, record.data) !== undefined
                );
              });
              if (!populated.length) return null;
              return (
              <Card key={section.title} className="overflow-hidden">
                <div className="border-b border-[#e8eef2] px-5 py-4">
                  <h2 className="text-sm font-bold text-[#263f4b]">
                    {section.title}
                  </h2>
                  {section.description ? (
                    <p className="mt-1 text-xs text-[#7b8d97]">
                      {section.description}
                    </p>
                  ) : null}
                </div>
                <dl className="grid md:grid-cols-2">
                  {populated.map((field) => (
                    <div
                      key={field.name}
                      className="border-b border-[#edf1f4] px-5 py-4 md:odd:border-r"
                    >
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-[#81929c]">
                        {field.label}
                      </dt>
                      <dd className="mt-1.5 text-sm font-semibold leading-6 text-[#304954]">
                        {displayValue(field, record.data, references.resolve)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
              );
            })}

            {config.hasLineItems ? (
              <Card className="overflow-hidden">
                <div className="border-b border-[#e8eef2] px-5 py-4">
                  <h2 className="text-sm font-bold text-[#263f4b]">
                    Transaction lines
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-xs">
                    <thead className="bg-[#f8fafc] text-[10px] uppercase text-[#7b8e98]">
                      <tr>
                        {[
                          "Item / account",
                          "Description",
                          "Qty",
                          "Rate",
                          "Amount",
                        ].map((item, index) => (
                          <th
                            key={item}
                            className={cn("px-5 py-3", index >= 2 && "text-right")}
                          >
                            {item}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        (record.data.lines as
                          Array<Record<string, unknown>> | undefined) ?? []
                      ).map((line, index) => (
                        <tr key={index} className="border-t border-[#edf1f4]">
                          <td className="px-5 py-4 font-bold">
                            {references.resolve(line.itemId ?? line.accountId)}
                          </td>
                          <td className="px-5 py-4">
                            {String(line.description ?? "—")}
                          </td>
                          <td className="px-5 py-4 text-right tabular-nums">
                            {line.quantity !== undefined &&
                            line.quantity !== null &&
                            line.quantity !== ""
                              ? formatDecimal(String(line.quantity))
                              : line.debit !== undefined ||
                                  line.credit !== undefined
                                ? ""
                                : "1"}
                          </td>
                          <td className="px-5 py-4 text-right tabular-nums">
                            {formatDecimal(
                              String(
                                line.unitPrice ??
                                  line.rate ??
                                  (Number(line.debit) > 0
                                    ? line.debit
                                    : line.credit) ??
                                  "0",
                              ),
                            )}
                          </td>
                          <td className="px-5 py-4 text-right font-bold tabular-nums">
                            {(() => {
                              const amount =
                                line.lineTotal ??
                                (Number(line.debit) > 0
                                  ? line.debit
                                  : line.credit);
                              return amount !== undefined
                                ? formatDecimal(String(amount))
                                : "—";
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}

            {isInvoice ? (
              <InvoiceAccountingPanels data={record.data} />
            ) : isCustomerPayment ? (
              <PaymentSettlementPanel data={record.data} />
            ) : (
              <RegisterCard
                activity={activity.data?.data}
                isLoading={activity.isLoading}
              />
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-sm font-bold text-[#263f4b]">Actions</h2>
              <div className="mt-4 space-y-2">
                {config.module === "sales" &&
                ["estimates", "sales-orders"].includes(config.slug) ? (
                  <button
                    onClick={async () => {
                      const target =
                        config.slug === "estimates" ? "invoices" : "invoices";
                      await salesService.convert(
                        config.slug as SalesResource,
                        row.id,
                        target,
                      );
                      notify(
                        "Invoice created",
                        "success",
                        `${displayId} was converted to a new draft invoice.`,
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-xl bg-[#007DCC] px-3 py-3 text-xs font-bold text-white"
                  >
                    <ArrowRight size={15} /> Convert to invoice
                  </button>
                ) : null}
                {isInvoice ? (
                  <>
                    {["open", "partially_paid", "paid", "overdue"].includes(
                      row.status.toLowerCase(),
                    ) ? (
                      <button
                        onClick={() =>
                          void runAction(
                            `/v1/sales/invoices/${encodeURIComponent(row.id)}/void`,
                            { reason: "Voided from the invoice detail page" },
                            "Invoice voided",
                            `${displayId} was reversed in the ledger.`,
                            `invoice:${row.id}:void`,
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700"
                      >
                        <RefreshCcw size={15} /> Void invoice (reversal)
                      </button>
                    ) : null}
                    <Link
                      href={`/sales/payments/new?invoice=${encodeURIComponent(row.id)}`}
                      className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"
                    >
                      <CheckCircle2 size={15} /> Receive payment
                    </Link>
                    <button
                      onClick={() => setPreviewOpen(true)}
                      className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"
                    >
                      <FileText size={15} /> Preview / download PDF
                    </button>
                  </>
                ) : null}
                {isCustomerPayment && row.status.toLowerCase() === "posted" ? (
                  <button
                    disabled={actionPending}
                    onClick={() => setReverseOpen(true)}
                    className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700 disabled:cursor-wait disabled:opacity-60"
                  >
                    {actionPending ? <LoaderCircle size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
                    {actionPending ? "Reversing payment…" : "Reverse Payment"}
                  </button>
                ) : null}
                {config.module === "sales" && config.slug === "credit-notes" ? (
                  <Link
                    href={`/sales/refund-receipts/new?credit=${encodeURIComponent(row.id)}`}
                    className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700"
                  >
                    <RefreshCcw size={15} /> Issue customer refund
                  </Link>
                ) : null}
                {config.module === "purchasing" &&
                config.slug === "purchase-orders" ? (
                  <>
                    <Link
                      href={`/purchasing/receipts/new?purchaseOrder=${encodeURIComponent(row.id)}`}
                      className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"
                    >
                      <CheckCircle2 size={15} /> Receive items
                    </Link>
                    <Link
                      href={`/purchasing/bills/new?purchaseOrder=${encodeURIComponent(row.id)}`}
                      className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"
                    >
                      <ArrowRight size={15} /> Convert to bill
                    </Link>
                  </>
                ) : null}
                {config.module === "purchasing" &&
                config.slug === "receipts" ? (
                  <Link
                    href={`/purchasing/bills/new?receipt=${encodeURIComponent(row.id)}`}
                    className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"
                  >
                    <ArrowRight size={15} /> Create bill from receipt
                  </Link>
                ) : null}
                {config.module === "purchasing" && config.slug === "bills" ? (
                  <Link
                    href={`/purchasing/bill-payments/new?bill=${encodeURIComponent(row.id)}`}
                    className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"
                  >
                    <CheckCircle2 size={15} /> Pay this bill
                  </Link>
                ) : null}
                {config.module === "purchasing" &&
                config.slug === "vendor-credits" ? (
                  <Link
                    href={`/purchasing/bill-payments/new?credit=${encodeURIComponent(row.id)}`}
                    className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700"
                  >
                    <RefreshCcw size={15} /> Apply to open bills
                  </Link>
                ) : null}
                {config.module === "inventory" &&
                config.slug === "fulfillment" ? (
                  <button
                    onClick={() => {
                      const action =
                        (
                          {
                            draft: "allocate",
                            allocated: "pick",
                            picked: "pack",
                            packed: "ship",
                          } as Record<string, string>
                        )[row.status.toLowerCase()] ?? "allocate";
                      void runAction(
                        `/v1/inventory/fulfillment/${encodeURIComponent(row.id)}/action`,
                        { action },
                        "Fulfillment advanced",
                        `${displayId} moved to ${action}.`,
                      );
                    }}
                    className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"
                  >
                    <ArrowRight size={15} /> Advance fulfillment stage
                  </button>
                ) : null}
                {config.module === "banking" && config.slug === "bank-feeds" ? (
                  <button
                    onClick={() =>
                      void runAction(
                        `/v1/banking/bank-feeds/${encodeURIComponent(row.id)}/action`,
                        { action: "add", accountId: "1000" },
                        "Transaction added",
                        `${displayId} was added to account 1000.`,
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"
                  >
                    <CheckCircle2 size={15} /> Add transaction
                  </button>
                ) : null}
                {config.module === "accounting" &&
                config.slug === "journal-entries" ? (
                  <>
                    <button
                      onClick={() =>
                        void runAction(
                          `/v1/accounting/journal-entries/${encodeURIComponent(row.id)}/post`,
                          undefined,
                          "Journal posted",
                          `${displayId} passed balance validation and was posted.`,
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"
                    >
                      <CheckCircle2 size={15} /> Validate and post journal
                    </button>
                    <Link
                      href={`/accounting/journal-entries/new?reverse=${encodeURIComponent(row.id)}`}
                      className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700"
                    >
                      <RefreshCcw size={15} /> Create reversing entry
                    </Link>
                  </>
                ) : null}
                {config.module === "accounting" && config.slug === "budgets" ? (
                  <Link
                    href={`/accounting/budgets/new?revision=${encodeURIComponent(row.id)}`}
                    className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"
                  >
                    <Copy size={15} /> Create budget revision
                  </Link>
                ) : null}
                {config.module === "projects" &&
                config.slug === "progress-billing" ? (
                  <Link
                    href={`/sales/invoices/new?projectBilling=${encodeURIComponent(row.id)}`}
                    className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"
                  >
                    <ArrowRight size={15} /> Create progress invoice
                  </Link>
                ) : null}
                {config.module === "payroll" && config.slug === "pay-runs" ? (
                  <button
                    onClick={() =>
                      void runAction(
                        `/v1/payroll/pay-runs/${encodeURIComponent(row.id)}/approve`,
                        undefined,
                        "Payroll approved",
                        `${displayId} is ready for payment and liability posting.`,
                      )
                    }
                    className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"
                  >
                    <CheckCircle2 size={15} /> Approve payroll
                  </button>
                ) : null}
                {!isCustomerPayment || row.status.toLowerCase() === "draft" ? <Link
                  href={`${listHref}/new?edit=${encodeURIComponent(row.id)}`}
                  className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"
                >
                  <Pencil size={15} /> Edit this record
                </Link> : null}
                {!isCustomerPayment || row.status.toLowerCase() === "draft" ? <button
                  onClick={() => setDeleteOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={15} /> Delete record
                </button> : null}
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-bold text-[#263f4b]">Audit trail</h2>
              <p className="mt-1 text-xs text-[#7b8d97]">
                Every recorded change to this record.
              </p>
              <div className="mt-4 space-y-4">
                {activity.data?.data.audit.length ? (
                  activity.data.data.audit.map((event, index) => (
                    <div key={`${event.occurredAt}-${index}`} className="flex gap-3">
                      <CheckCircle2
                        size={16}
                        className="mt-0.5 text-emerald-500"
                      />
                      <div>
                        <p className="text-xs font-bold capitalize text-[#405762]">
                          {event.action}
                        </p>
                        <p className="mt-1 text-[10px] text-[#82949e]">
                          {event.occurredAt.slice(0, 19).replace("T", " ")}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#7b8d97]">
                    {activity.isLoading
                      ? "Loading the audit trail\u2026"
                      : "No changes have been recorded yet."}
                  </p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
      <ConfirmDeleteDialog
        open={deleteOpen}
        title={`Delete ${displayId}?`}
        recordName={`${displayId} · ${row.cells[0] ?? config.title}`}
        description={`This ${config.title.toLowerCase()} record will move to Trash. It can be restored later and will never be permanently removed.`}
        onClose={() => setDeleteOpen(false)}
        onConfirm={async () => {
          await mutations.remove.mutateAsync(row.id);
          router.push(`${listHref}?deleted=${encodeURIComponent(displayId)}`);
        }}
      />
      <ConfirmDeleteDialog
        open={reverseOpen}
        title={`Reverse ${displayId}?`}
        recordName={`${displayId} · ${row.cells[0] ?? config.title}`}
        description="The posted payment will not be deleted. Its accounting effect will be reversed, restoring invoice balances and customer AR."
        confirmLabel="Reverse Payment"
        pendingLabel="Reversing…"
        confirming={actionPending}
        onClose={() => {
          if (!actionPending) setReverseOpen(false);
        }}
        onConfirm={async () => {
          const succeeded = await runAction(
            `/v1/sales/payments/${encodeURIComponent(row.id)}/reverse`,
            { reason: "Reversed from the payment detail page" },
            "Payment reversed",
            `${displayId} restored invoice and customer balances.`,
            `payment:${row.id}:reverse`,
          );
          if (succeeded) setReverseOpen(false);
        }}
      />
      {config.module === "sales" ? (
        <InvoicePreviewDialog
          open={previewOpen}
          document={buildDocumentPreview(record.data, {
            documentNumber: displayId,
            documentTitle: config.title.replace(/s$/, ""),
            resolveReference: references.resolve,
          })}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </AppShell>
  );
}
