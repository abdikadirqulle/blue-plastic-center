import type { ResourceRecord } from "../../platform/types.js"
import { deriveInvoiceStatus } from "./invoice-domain.js"

export interface InvoiceRowView {
  id: string
  companyId: string
  branchId: string
  customerId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  currency: string
  exchangeRate: string
  status: string
  customerPurchaseOrder?: string | null
  memo?: string | null
  discountType?: string | null
  discountValue?: string | null
  subtotal: string
  discountTotal: string
  taxTotal: string
  total: string
  amountPaid: string
  balanceDue: string
  postedAt?: string | null
  postedBy?: string | null
  voidedAt?: string | null
  voidedBy?: string | null
  voidReason?: string | null
  version: number
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
  isDeleted: boolean
  deletedAt?: string | null
}

export interface InvoiceLineView {
  id: string
  itemId?: string | null
  itemName?: string | null
  accountId?: string | null
  accountName?: string | null
  warehouseId?: string | null
  description: string
  unit?: string | null
  quantity: string
  unitPrice: string
  discountAmount: string
  taxRate: string
  taxAmount: string
  lineTotal: string
  lineNumber: number
}

export interface InvoiceRelations {
  customerName?: string
  lines?: InvoiceLineView[]
  postingTransactionId?: string
  postingTransactionNumber?: string
  reversalTransactionId?: string
  inventoryMovements?: Array<Record<string, unknown>>
  auditHistory?: Array<Record<string, unknown>>
}

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Single projection of a relational invoice into the transport record used by
 * every client. Both the PostgreSQL and in-memory repositories go through here
 * so the API shape cannot drift between runtimes.
 */
export function toInvoiceRecord(
  row: InvoiceRowView,
  relations: InvoiceRelations = {},
): ResourceRecord {
  const status = deriveInvoiceStatus({
    status: row.status,
    total: row.total,
    amountPaid: row.amountPaid,
    dueDate: row.dueDate,
    asOf: today(),
  })
  return {
    id: row.id,
    module: "sales",
    resource: "invoices",
    companyId: row.companyId,
    branchId: row.branchId,
    status,
    version: row.version,
    data: {
      customerId: row.customerId,
      customerName: relations.customerName,
      documentNumber: row.invoiceNumber,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      currency: row.currency,
      exchangeRate: row.exchangeRate,
      customerPurchaseOrder: row.customerPurchaseOrder ?? undefined,
      memo: row.memo ?? undefined,
      discountType: row.discountType ?? "none",
      discountValue: row.discountValue ?? "0.0000",
      subtotal: row.subtotal,
      discountTotal: row.discountTotal,
      taxTotal: row.taxTotal,
      total: row.total,
      amountPaid: row.amountPaid,
      balanceDue: row.balanceDue,
      status,
      postedAt: row.postedAt ?? undefined,
      postedBy: row.postedBy ?? undefined,
      voidedAt: row.voidedAt ?? undefined,
      voidedBy: row.voidedBy ?? undefined,
      voidReason: row.voidReason ?? undefined,
      postingTransactionId: relations.postingTransactionId,
      postingTransactionNumber: relations.postingTransactionNumber,
      reversalTransactionId: relations.reversalTransactionId,
      inventoryMovements: relations.inventoryMovements,
      auditHistory: relations.auditHistory,
      lines: (relations.lines ?? []).map((line) => ({
        id: line.id,
        itemId: line.itemId ?? undefined,
        itemName: line.itemName ?? undefined,
        accountId: line.accountId ?? undefined,
        accountName: line.accountName ?? undefined,
        warehouseId: line.warehouseId ?? undefined,
        description: line.description,
        unit: line.unit ?? undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        lineTotal: line.lineTotal,
        lineNumber: line.lineNumber,
      })),
    },
    createdAt: row.createdAt,
    createdBy: row.createdBy,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy,
    isDeleted: row.isDeleted,
    deletedAt: row.deletedAt ?? undefined,
  }
}
