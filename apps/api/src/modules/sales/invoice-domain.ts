import type { InvoiceStatus } from "@blue-plastic/types"
import { decimalToMinor } from "../accounting/ledger-math.js"
import { systemAccountKeys, type SystemAccountKey } from "../accounting/system-accounts.js"

export interface InvoiceLineSource {
  itemId?: string
  itemName?: string
  itemType?: string
  incomeAccountId?: string
  inventoryAccountId?: string
  expenseAccountId?: string
  accountId?: string
  accountName?: string
  warehouseId?: string
}

const stockedItemTypes = new Set(["inventory", "assembly"])

/** Only stocked item types move quantities. Services never touch inventory. */
export function reducesStock(source: InvoiceLineSource) {
  return Boolean(source.itemId) && stockedItemTypes.has(String(source.itemType))
}

/**
 * Chooses the revenue target for a line. An explicitly configured account wins;
 * otherwise the stable system key for the item type is used.
 */
export function revenueTarget(source: InvoiceLineSource): {
  revenueAccountId?: string
  revenueSystemAccountKey: SystemAccountKey
} {
  const fallback = source.itemId
    ? reducesStock(source)
      ? systemAccountKeys.SALES_REVENUE
      : systemAccountKeys.SERVICE_REVENUE
    : systemAccountKeys.SERVICE_REVENUE
  const revenueAccountId = source.itemId ? source.incomeAccountId : source.accountId
  return { revenueAccountId, revenueSystemAccountKey: fallback }
}

export const invoiceStatuses = [
  "draft",
  "open",
  "partially_paid",
  "paid",
  "overdue",
  "voided",
] as const

const settledStatuses = new Set<InvoiceStatus>(["paid", "voided"])
const postedStatuses = new Set<InvoiceStatus>([
  "open",
  "partially_paid",
  "paid",
  "overdue",
])

export function isInvoiceStatus(value: string): value is InvoiceStatus {
  return (invoiceStatuses as readonly string[]).includes(value)
}

export function isPostedInvoiceStatus(status: string) {
  return postedStatuses.has(status as InvoiceStatus)
}

export function canEditInvoice(status: string) {
  return status === "draft"
}

export function canDeleteInvoice(status: string) {
  return status === "draft"
}

export function canPostInvoice(status: string) {
  return status === "draft"
}

export function canVoidInvoice(status: string) {
  return isPostedInvoiceStatus(status)
}

/**
 * Derives the lifecycle status of a posted invoice from its money and dates.
 * Draft and voided invoices are terminal inputs and are never recomputed.
 */
export function deriveInvoiceStatus(input: {
  status: string
  total: string
  amountPaid: string
  dueDate: string
  asOf: string
}): InvoiceStatus {
  if (input.status === "draft") return "draft"
  if (input.status === "voided") return "voided"
  const total = decimalToMinor(input.total)
  const paid = decimalToMinor(input.amountPaid)
  if (paid >= total && total > 0n) return "paid"
  if (settledStatuses.has(input.status as InvoiceStatus)) return input.status as InvoiceStatus
  if (input.dueDate < input.asOf) return "overdue"
  if (paid > 0n) return "partially_paid"
  return "open"
}
