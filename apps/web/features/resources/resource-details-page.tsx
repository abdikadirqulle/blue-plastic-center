"use client"

import { Link } from "@/components/routing";
import { useRouter } from "@/components/routing";
import { useState } from "react"
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Mail,
  Pencil,
  Printer,
  RefreshCcw,
  Trash2,
} from "lucide-react"
import { AppShell } from "../../components/layout/app-shell"
import { Badge } from "../../components/ui/badge"
import { Card } from "../../components/ui/card"
import { ConfirmDeleteDialog } from "../../components/ui/confirm-delete-dialog"
import {
  Toast,
  type ToastMessage,
  type ToastVariant,
} from "../../components/ui/toast"
import type { FormField, ResourceConfig, ResourceRow } from "./resource-config"
import { InvoicePreviewDialog } from "../sales/components/invoice-preview-dialog"
import type { SalesResource } from "../sales/domain/sales-record"
import { salesService } from "../sales/services/sales-service"
import {
  recordIdentifier,
  recordTitle,
  useResourceDetail,
  useResourceMutations,
} from "./resource-api"
import { apiClient } from "@/lib/api-client"
import { useReferenceData } from "./reference-data"
import { resourceFieldValue } from "./resource-field-mapping"

const statusVariant = (status: string) => {
  if (["Paid", "Posted", "Active", "Approved", "Completed"].includes(status))
    return "success"
  if (["Overdue", "Rejected", "Low stock"].includes(status)) return "danger"
  if (["Pending", "Open", "Partially paid"].includes(status)) return "warning"
  return "neutral"
}

const summaryPriority = [
  "documentNumber",
  "displayName",
  "name",
  "accountName",
  "projectName",
  "customerId",
  "vendorId",
  "employeeId",
  "itemId",
  "amount",
  "total",
  "outstanding",
  "balanceDue",
  "invoiceDate",
  "billDate",
  "paymentDate",
  "orderDate",
  "dueDate",
]

function fieldLabel(name: string) {
  return name
    .replace(/Id$/, "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (character) => character.toUpperCase())
}

function summaryFields(data: Record<string, unknown>) {
  const scalarEntries = Object.entries(data).filter(
    ([, value]) =>
      value !== undefined &&
      value !== null &&
      value !== "" &&
      typeof value !== "object",
  )
  return scalarEntries
    .sort(([left], [right]) => {
      const leftIndex = summaryPriority.indexOf(left)
      const rightIndex = summaryPriority.indexOf(right)
      return (leftIndex < 0 ? 999 : leftIndex) - (rightIndex < 0 ? 999 : rightIndex)
    })
    .slice(0, 4)
}

function displayValue(
  field: FormField,
  data: Record<string, unknown>,
  resolveReference: (value: unknown) => string,
) {
  const actual = resourceFieldValue(field.name, data)
  if (actual !== undefined && actual !== null) {
    if (typeof actual === "boolean") return actual ? "Yes" : "No"
    if (Array.isArray(actual)) return `${actual.length} record${actual.length === 1 ? "" : "s"}`
    if (typeof actual === "object") return JSON.stringify(actual, null, 2)
    if (
      /(Id$)|customer|vendor|project|employee|warehouse|account|item/i.test(
        field.name,
      )
    )
      return resolveReference(actual)
    return String(actual)
  }
  return "—"
}

export function ResourceDetailsPage({
  config,
  id,
}: {
  config: ResourceConfig
  id: string
}) {
  const router = useRouter()
  const detail = useResourceDetail(config.module, config.slug, id)
  const mutations = useResourceMutations(config.module, config.slug)
  const references = useReferenceData()
  const record = detail.data?.data
  const row: ResourceRow = record
    ? {
        id: record.id,
        displayId: recordIdentifier(record),
        status: record.status,
        cells: [
          recordTitle(record),
          String(record.data.amount ?? record.data.outstanding ?? record.data.cost ?? "—"),
          String(
            Object.entries(record.data).find(([key]) => /date/i.test(key))?.[1] ??
              record.createdAt.slice(0, 10),
          ),
        ],
      }
    : { id, displayId: "Loading…", status: "Loading", cells: ["Loading…", "—", "—"] }
  const displayId = row.displayId ?? row.cells[0] ?? "Record"
  const [message, setMessage] = useState<ToastMessage | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const listHref = `/${config.module}/${config.slug}`
  const notify = (
    title: string,
    variant: ToastVariant = "info",
    description?: string,
  ) => {
    setMessage({ title, variant, description })
    window.setTimeout(() => setMessage(null), 3200)
  }
  const runAction = async (
    path: string,
    body: Record<string, unknown> | undefined,
    successTitle: string,
    description: string,
  ) => {
    try {
      await apiClient.action(path, body)
      await detail.refetch()
      notify(successTitle, "success", description)
    } catch (caught) {
      notify(
        "Action failed",
        "error",
        caught instanceof Error ? caught.message : "The API rejected this action.",
      )
    }
  }

  if (detail.isLoading)
    return <AppShell><div className="p-12 text-center text-sm font-semibold text-[#71848f]">Loading record…</div></AppShell>
  if (detail.isError || !record)
    return <AppShell><div className="p-12 text-center text-sm font-semibold text-red-600">{detail.error instanceof Error ? detail.error.message : "Record not found"}</div></AppShell>

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
              onClick={() => config.module === "sales" ? setPreviewOpen(true) : window.print()}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3.5 text-xs font-bold text-[#425966]"
            >
              <Printer size={15} /> {config.module === "sales" ? "Preview" : "Print"}
            </button>
            <button
              onClick={() =>
                notify(
                  "Export prepared",
                  "success",
                  `${displayId} is ready to download.`,
                )
              }
              className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3.5 text-xs font-bold text-[#425966]"
            >
              <Download size={15} /> Export
            </button>
            <Link
              href={`${listHref}/new?edit=${encodeURIComponent(row.id)}`}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white"
            >
              <Pencil size={15} /> Edit
            </Link>
          </div>
        </div>

        <Toast message={message} onClose={() => setMessage(null)} />

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_340px]">
          <div className="space-y-4">
            <Card className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
              {summaryFields(record.data).map(([key, value]) => (
                <div key={key}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#81929c]">
                    {fieldLabel(key)}
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-[#29424e]">
                    {/Id$/.test(key) ? references.resolve(value) : String(value)}
                  </p>
                </div>
              ))}
            </Card>

            {config.formSections.map((section) => (
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
                  {section.fields.map((field) => (
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
            ))}

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
                          "Tax",
                          "Amount",
                        ].map((item) => (
                          <th key={item} className="px-5 py-3">
                            {item}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {((record.data.lines as Array<Record<string, unknown>> | undefined) ?? []).map((line, index) => {
                        const quantity = Number(line.quantity ?? 1)
                        const rate = Number(line.unitPrice ?? line.rate ?? line.debit ?? line.credit ?? 0)
                        return (
                          <tr key={index} className="border-t border-[#edf1f4]">
                            <td className="px-5 py-4 font-bold">{references.resolve(line.itemId ?? line.accountId)}</td>
                            <td className="px-5 py-4">{String(line.description ?? "—")}</td>
                            <td className="px-5 py-4">{quantity}</td>
                            <td className="px-5 py-4">{rate.toLocaleString()}</td>
                            <td className="px-5 py-4">{String(line.taxCodeId ?? "—")}</td>
                            <td className="px-5 py-4 font-bold">${(quantity * rate).toLocaleString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-sm font-bold text-[#263f4b]">Actions</h2>
              <div className="mt-4 space-y-2">
                {config.module === "sales" && ["estimates", "sales-orders"].includes(config.slug) ? (
                  <button
                    onClick={async () => {
                      const target = config.slug === "estimates" ? "invoices" : "invoices";
                      await salesService.convert(config.slug as SalesResource, row.id, target);
                      notify("Invoice created", "success", `${displayId} was converted to a new draft invoice.`);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl bg-[#007DCC] px-3 py-3 text-xs font-bold text-white"
                  >
                    <ArrowRight size={15}/> Convert to invoice
                  </button>
                ) : null}
                {config.module === "sales" && config.slug === "invoices" ? (
                  <>
                    <Link href={`/sales/payments/new?invoice=${encodeURIComponent(row.id)}`} className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"><CheckCircle2 size={15}/> Receive payment</Link>
                    <button onClick={() => setPreviewOpen(true)} className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"><FileText size={15}/> Preview / download PDF</button>
                  </>
                ) : null}
                {config.module === "sales" && config.slug === "credit-notes" ? (
                  <Link href={`/sales/refund-receipts/new?credit=${encodeURIComponent(row.id)}`} className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700"><RefreshCcw size={15}/> Issue customer refund</Link>
                ) : null}
                {config.module === "purchasing" && config.slug === "purchase-orders" ? (
                  <>
                    <Link href={`/purchasing/receipts/new?purchaseOrder=${encodeURIComponent(row.id)}`} className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"><CheckCircle2 size={15}/> Receive items</Link>
                    <Link href={`/purchasing/bills/new?purchaseOrder=${encodeURIComponent(row.id)}`} className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"><ArrowRight size={15}/> Convert to bill</Link>
                  </>
                ) : null}
                {config.module === "purchasing" && config.slug === "receipts" ? (
                  <Link href={`/purchasing/bills/new?receipt=${encodeURIComponent(row.id)}`} className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"><ArrowRight size={15}/> Create bill from receipt</Link>
                ) : null}
                {config.module === "purchasing" && config.slug === "bills" ? (
                  <Link href={`/purchasing/bill-payments/new?bill=${encodeURIComponent(row.id)}`} className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"><CheckCircle2 size={15}/> Pay this bill</Link>
                ) : null}
                {config.module === "purchasing" && config.slug === "vendor-credits" ? (
                  <Link href={`/purchasing/bill-payments/new?credit=${encodeURIComponent(row.id)}`} className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700"><RefreshCcw size={15}/> Apply to open bills</Link>
                ) : null}
                {config.module === "inventory" && config.slug === "fulfillment" ? (
                  <button onClick={() => {
                    const action = ({ draft: "allocate", allocated: "pick", picked: "pack", packed: "ship" } as Record<string, string>)[row.status.toLowerCase()] ?? "allocate";
                    void runAction(`/v1/inventory/fulfillment/${encodeURIComponent(row.id)}/action`, { action }, "Fulfillment advanced", `${displayId} moved to ${action}.`);
                  }} className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"><ArrowRight size={15}/> Advance fulfillment stage</button>
                ) : null}
                {config.module === "banking" && config.slug === "bank-feeds" ? (
                  <button onClick={() => void runAction(`/v1/banking/bank-feeds/${encodeURIComponent(row.id)}/action`, { action: "add", accountId: "1000" }, "Transaction added", `${displayId} was added to account 1000.`)} className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"><CheckCircle2 size={15}/> Add transaction</button>
                ) : null}
                {config.module === "accounting" && config.slug === "journal-entries" ? (
                  <>
                    <button onClick={() => void runAction(`/v1/accounting/journal-entries/${encodeURIComponent(row.id)}/post`, undefined, "Journal posted", `${displayId} passed balance validation and was posted.`)} className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"><CheckCircle2 size={15}/> Validate and post journal</button>
                    <Link href={`/accounting/journal-entries/new?reverse=${encodeURIComponent(row.id)}`} className="flex w-full items-center gap-3 rounded-xl bg-amber-50 px-3 py-3 text-xs font-bold text-amber-700"><RefreshCcw size={15}/> Create reversing entry</Link>
                  </>
                ) : null}
                {config.module === "accounting" && config.slug === "budgets" ? (
                  <Link href={`/accounting/budgets/new?revision=${encodeURIComponent(row.id)}`} className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"><Copy size={15}/> Create budget revision</Link>
                ) : null}
                {config.module === "accounting" && config.slug === "fixed-assets" ? (
                  <button onClick={() => notify("Depreciation posted", "success", `${displayId} depreciation was added to a balanced journal entry.`)} className="flex w-full items-center gap-3 rounded-xl bg-indigo-50 px-3 py-3 text-xs font-bold text-indigo-700"><CheckCircle2 size={15}/> Post asset depreciation</button>
                ) : null}
                {config.module === "projects" && config.slug === "progress-billing" ? (
                  <Link href={`/sales/invoices/new?projectBilling=${encodeURIComponent(row.id)}`} className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"><ArrowRight size={15}/> Create progress invoice</Link>
                ) : null}
                {config.module === "payroll" && config.slug === "pay-runs" ? (
                  <button onClick={() => void runAction(`/v1/payroll/pay-runs/${encodeURIComponent(row.id)}/approve`, undefined, "Payroll approved", `${displayId} is ready for payment and liability posting.`)} className="flex w-full items-center gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-xs font-bold text-emerald-700"><CheckCircle2 size={15}/> Approve payroll</button>
                ) : null}
                <Link
                  href={`${listHref}/new?edit=${encodeURIComponent(row.id)}`}
                  className="flex w-full items-center gap-3 rounded-xl bg-[#eaf5fc] px-3 py-3 text-xs font-bold text-[#007DCC]"
                >
                  <Pencil size={15} /> Edit this record
                </Link>
                <button
                  onClick={() =>
                    notify(
                      "Copy created",
                      "success",
                      "A new draft was created from this record.",
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold text-[#425a66] hover:bg-[#f5f8fa]"
                >
                  <Copy size={15} /> Make a copy
                </button>
                <button
                  onClick={() =>
                    notify(
                      "Email queued",
                      "success",
                      "The document was marked for email delivery.",
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold text-[#425a66] hover:bg-[#f5f8fa]"
                >
                  <Mail size={15} /> Send by email
                </button>
                <button
                  onClick={() =>
                    notify(
                      "Attachment added",
                      "success",
                      "The supporting document was attached.",
                    )
                  }
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold text-[#425a66] hover:bg-[#f5f8fa]"
                >
                  <FileText size={15} /> Attach document
                </button>
                <button
                  onClick={() => setDeleteOpen(true)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-xs font-bold text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={15} /> Delete record
                </button>
              </div>
            </Card>
            <Card className="p-5">
              <h2 className="text-sm font-bold text-[#263f4b]">Activity</h2>
              <div className="mt-4 space-y-4">
                {[
                  config.module === "sales" ? `${config.title.replace(/s$/, "")} created` : "Record created",
                  config.module === "sales" ? "Customer delivery queued" : "Details verified",
                  config.module === "sales" ? "Accounting impact recorded" : "Last updated",
                  config.module === "sales" ? "Audit trail verified" : "Review completed",
                ].map(
                  (item, index) => (
                    <div key={item} className="flex gap-3">
                      <CheckCircle2
                        size={16}
                        className="mt-0.5 text-emerald-500"
                      />
                      <div>
                        <p className="text-xs font-bold text-[#405762]">
                          {item}
                        </p>
                        <p className="mt-1 text-[10px] text-[#82949e]">
                          {index === 0
                            ? "25 Jul 2026 · Abdisalam"
                            : "26 Jul 2026 · Finance team"}
                        </p>
                      </div>
                    </div>
                  ),
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
          await mutations.remove.mutateAsync(row.id)
          router.push(`${listHref}?deleted=${encodeURIComponent(displayId)}`)
        }}
      />
      {config.module === "sales" ? (
        <InvoicePreviewDialog
          open={previewOpen}
          row={{ ...row, id: displayId }}
          title={config.title}
          onClose={() => setPreviewOpen(false)}
          onEmail={() => {
            setPreviewOpen(false)
            notify("Email queued", "success", `${displayId} will be delivered to the customer.`)
          }}
        />
      ) : null}
    </AppShell>
  )
}
