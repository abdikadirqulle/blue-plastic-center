import { z } from "zod"
import {
  currencyCode,
  decimalString,
  documentBase,
  identifier,
  isoDate,
  partySchema,
  positiveDecimal,
  type OperationalSchema,
} from "../operations/operational.schemas.js"

const customerDocument = documentBase.extend({
  customerId: identifier,
})

export const salesSchemas: Record<string, OperationalSchema> = {
  customers: partySchema,
  estimates: customerDocument.extend({
    estimateDate: isoDate,
    expiryDate: isoDate.optional(),
  }),
  "sales-orders": customerDocument.extend({
    orderDate: isoDate,
    requestedShipDate: isoDate.optional(),
  }),
  invoices: customerDocument.extend({
    invoiceDate: isoDate,
    dueDate: isoDate,
  }),
  payments: z.object({
    customerId: identifier,
    paymentDate: isoDate,
    amount: positiveDecimal,
    currency: currencyCode,
    depositToAccountId: identifier,
    paymentMethod: z.string().min(1),
    allocations: z.array(z.object({
      invoiceId: identifier,
      amount: positiveDecimal,
    })).default([]),
    reference: z.string().optional(),
  }).passthrough(),
  "credit-notes": customerDocument.extend({
    creditDate: isoDate,
  }),
  "sales-receipts": customerDocument.extend({
    saleDate: isoDate,
    depositToAccountId: identifier,
    paymentMethod: z.string().min(1),
  }),
  "refund-receipts": customerDocument.extend({
    refundDate: isoDate,
    paymentAccountId: identifier,
  }),
  statements: z.object({
    customerId: identifier,
    statementDate: isoDate,
    fromDate: isoDate.optional(),
    toDate: isoDate,
  }).passthrough(),
  deposits: z.object({
    customerId: identifier,
    depositTo: identifier,
    depositDate: isoDate,
    amount: positiveDecimal,
    currency: currencyCode,
  }).passthrough(),
  "recurring-invoices": customerDocument.extend({
    templateName: z.string().min(2),
    frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
    startDate: isoDate,
    endDate: isoDate.optional(),
  }),
}

export const conversionSchema = z.object({
  targetResource: z.enum(["sales-orders", "invoices"]),
})

export const allocationSchema = z.object({
  allocations: z.array(z.object({
    invoiceId: identifier,
    amount: positiveDecimal,
  })).min(1),
})

export const emailDocumentSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().max(5000).optional(),
})

export { decimalString }
