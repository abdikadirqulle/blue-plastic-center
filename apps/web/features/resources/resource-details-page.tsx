"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  Mail,
  Pencil,
  Printer,
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

const statusVariant = (status: string) => {
  if (["Paid", "Posted", "Active", "Approved", "Completed"].includes(status))
    return "success"
  if (["Overdue", "Rejected", "Low stock"].includes(status)) return "danger"
  if (["Pending", "Open", "Partially paid"].includes(status)) return "warning"
  return "neutral"
}

function displayValue(field: FormField, index: number, row: ResourceRow) {
  if (index === 0) return row.cells[0] ?? row.id
  if (
    /amount|price|balance|total|budget|value|cost|principal|rate/i.test(
      field.name,
    )
  )
    return row.cells[1] ?? "$0.00"
  if (field.type === "date") return row.cells[2] ?? "26 Jul 2026"
  if (field.type === "checkbox") return "Yes"
  if (field.type === "select") return field.options?.[0] ?? "Not specified"
  if (/email/i.test(field.name)) return "accounts@blueplastic.example"
  if (/phone|mobile/i.test(field.name)) return "+252 61 555 0100"
  if (/address/i.test(field.name)) return "Maka Al Mukarama Road, Mogadishu"
  if (/currency/i.test(field.name)) return "USD"
  if (/memo|note|description/i.test(field.name))
    return `Recorded for ${row.cells[0] ?? row.id}. Verified against the original transaction and supporting documents.`
  return `${field.label} for ${row.cells[0] ?? row.id}`
}

export function ResourceDetailsPage({
  config,
  row,
}: {
  config: ResourceConfig
  row: ResourceRow
}) {
  const router = useRouter()
  const [message, setMessage] = useState<ToastMessage | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const listHref = `/${config.module}/${config.slug}`
  const notify = (
    title: string,
    variant: ToastVariant = "info",
    description?: string,
  ) => {
    setMessage({ title, variant, description })
    window.setTimeout(() => setMessage(null), 3200)
  }

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
                {row.id}
              </h1>
              <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-[#526a76]">
              {row.cells[0]}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => window.print()}
              className="flex h-10 items-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-3.5 text-xs font-bold text-[#425966]"
            >
              <Printer size={15} /> Print
            </button>
            <button
              onClick={() =>
                notify(
                  "Export prepared",
                  "success",
                  `${row.id} is ready to download.`,
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
              {config.columns.slice(0, 4).map((column, index) => (
                <div key={column}>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[#81929c]">
                    {column}
                  </p>
                  <p className="mt-1.5 text-sm font-bold text-[#29424e]">
                    {index === 0 ? row.id : (row.cells[index - 1] ?? "—")}
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
                  {section.fields.map((field, index) => (
                    <div
                      key={field.name}
                      className="border-b border-[#edf1f4] px-5 py-4 md:odd:border-r"
                    >
                      <dt className="text-[10px] font-bold uppercase tracking-wide text-[#81929c]">
                        {field.label}
                      </dt>
                      <dd className="mt-1.5 text-sm font-semibold leading-6 text-[#304954]">
                        {displayValue(field, index, row)}
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
                      <tr className="border-t border-[#edf1f4]">
                        <td className="px-5 py-4 font-bold">{row.cells[0]}</td>
                        <td className="px-5 py-4">Primary transaction line</td>
                        <td className="px-5 py-4">1</td>
                        <td className="px-5 py-4">{row.cells[1]}</td>
                        <td className="px-5 py-4">Standard</td>
                        <td className="px-5 py-4 font-bold">{row.cells[1]}</td>
                      </tr>
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
                {["Record created", "Details verified", "Last updated"].map(
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
        title={`Delete ${row.id}?`}
        recordName={`${row.id} · ${row.cells[0] ?? config.title}`}
        description={`This ${config.title.toLowerCase()} record will be permanently removed. Related audit references remain available to administrators.`}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() =>
          router.push(`${listHref}?deleted=${encodeURIComponent(row.id)}`)
        }
      />
    </AppShell>
  )
}
