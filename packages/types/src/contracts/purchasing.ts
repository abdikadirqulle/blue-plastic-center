import { z } from "zod"
import {
  currencyCode,
  documentBase,
  identifier,
  isoDate,
  partySchema,
  positiveDecimal,
  transactionLines,
  type OperationalSchema,
} from "./operational.js"

const vendorDocument = documentBase.extend({ vendorId: identifier })

export const purchasingSchemas: Record<string, OperationalSchema> = {
  vendors: partySchema,
  "purchase-orders": vendorDocument.extend({
    orderDate: isoDate,
    expectedDate: isoDate.optional(),
  }),
  receipts: z.object({
    vendorId: identifier,
    purchaseOrderId: identifier.optional(),
    receiptDate: isoDate,
    warehouseId: identifier,
    lines: transactionLines,
  }).passthrough(),
  bills: vendorDocument.extend({
    billDate: isoDate,
    dueDate: isoDate,
    vendorReference: z.string().optional(),
  }),
  "bill-payments": z.object({
    vendorId: identifier,
    bankAccount: identifier,
    paymentDate: isoDate,
    paymentMethod: z.string().min(1),
    currency: currencyCode,
    bills: z.array(z.object({ billId: identifier, amount: positiveDecimal })).min(1),
  }).passthrough(),
  "vendor-credits": vendorDocument.extend({
    creditDate: isoDate,
  }),
  expenses: z.object({
    payee: z.string().min(1),
    paymentDate: isoDate,
    accountId: identifier,
    paymentAccountId: identifier,
    amount: positiveDecimal,
    currency: currencyCode,
  }).passthrough(),
  approvals: z.object({
    documentType: z.string().min(1),
    documentId: identifier,
    approverId: identifier,
    decision: z.enum(["pending", "approved", "rejected", "changes-requested"]).default("pending"),
  }).passthrough(),
  checks: z.object({
    bankAccount: identifier,
    payee: z.string().min(1),
    checkNumber: z.string().min(1),
    checkDate: isoDate,
    amount: positiveDecimal,
    currency: currencyCode,
  }).passthrough(),
}

export const receivePurchaseOrderSchema = z.object({
  receiptDate: isoDate,
  warehouseId: identifier,
  lines: z.array(z.object({
    lineNumber: z.number().int().positive(),
    quantityReceived: positiveDecimal,
  })).min(1),
})

export const approvalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "changes-requested"]),
  note: z.string().max(2000).optional(),
})
