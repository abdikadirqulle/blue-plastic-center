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
} from "./operational.js"

const customerDocument = documentBase.extend({
  customerId: identifier,
})

/**
 * Canonical invoice write contract. Financial totals are deliberately absent:
 * the API calculates them and never trusts totals supplied by a browser.
 */
export const invoiceStatusSchema = z.enum([
  "draft",
  "open",
  "partially_paid",
  "paid",
  "overdue",
  "voided",
])

export const invoiceDecimalSchema = z
  .string()
  .regex(/^\d+(\.\d{1,4})?$/, "Must be a non-negative decimal with at most 4 places")

export const invoicePositiveDecimalSchema = invoiceDecimalSchema.refine(
  (value) => BigInt(value.replace(".", "")) > 0n,
  "Must be greater than zero",
)

/** Tax rate expressed as a percentage, for example "5" or "17.5000". */
export const invoiceTaxRateSchema = invoiceDecimalSchema.refine(
  (value) => Number(value) <= 100,
  "Tax rate cannot exceed 100 percent",
)

export const invoiceLineInputSchema = z
  .object({
    itemId: identifier.optional(),
    accountId: identifier.optional(),
    description: z.string().trim().min(1).max(500),
    quantity: invoicePositiveDecimalSchema.default("1"),
    unitPrice: invoiceDecimalSchema.default("0"),
    discountAmount: invoiceDecimalSchema.default("0"),
    taxRate: invoiceTaxRateSchema.default("0"),
    unit: z.string().trim().min(1).max(50).optional(),
    warehouseId: identifier.optional(),
  })
  .refine((line) => Boolean(line.itemId) !== Boolean(line.accountId), {
    message: "Each invoice line requires exactly one itemId or accountId",
    path: ["itemId"],
  })

const invoiceDataShape = {
  customerId: identifier,
  invoiceDate: isoDate,
  dueDate: isoDate,
  currency: currencyCode,
  exchangeRate: invoicePositiveDecimalSchema.default("1"),
  documentNumber: z.string().trim().min(1).max(100).optional(),
  customerPurchaseOrder: z.string().trim().max(100).optional(),
  memo: z.string().trim().max(2000).optional(),
  discountType: z.enum(["none", "percentage", "fixed"]).default("none"),
  discountValue: invoiceDecimalSchema.default("0"),
  lines: z.array(invoiceLineInputSchema).min(1).max(500),
}

export const invoiceCreateDataSchema = z.object(invoiceDataShape).passthrough()
export const invoiceUpdateDataSchema = z.object(invoiceDataShape).partial().passthrough()

export const invoiceCalculatedLineSchema = invoiceLineInputSchema.and(
  z.object({ lineTotal: invoiceDecimalSchema }),
)

export const invoiceTotalsSchema = z.object({
  subtotal: invoiceDecimalSchema,
  discountTotal: invoiceDecimalSchema,
  taxTotal: invoiceDecimalSchema,
  total: invoiceDecimalSchema,
  amountPaid: invoiceDecimalSchema,
  balanceDue: invoiceDecimalSchema,
})

export const invoiceVoidSchema = z.object({
  voidDate: isoDate.optional(),
  reason: z.string().trim().min(1).max(500).optional(),
})

export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>
export type InvoiceVoidInput = z.infer<typeof invoiceVoidSchema>
export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>
export type InvoiceCreateData = z.infer<typeof invoiceCreateDataSchema>
export type InvoiceUpdateData = z.infer<typeof invoiceUpdateDataSchema>
export type InvoiceTotals = z.infer<typeof invoiceTotalsSchema>

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
  invoices: invoiceCreateDataSchema,
  payments: z
    .object({
      customerId: identifier,
      paymentDate: isoDate,
      amount: positiveDecimal,
      currency: currencyCode,
      depositToAccountId: identifier,
      paymentMethod: z.string().min(1),
      allocations: z
        .array(
          z.object({
            invoiceId: identifier,
            amount: positiveDecimal,
          }),
        )
        .default([]),
      reference: z.string().optional(),
    })
    .passthrough(),
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
  statements: z
    .object({
      customerId: identifier,
      statementDate: isoDate,
      fromDate: isoDate.optional(),
      toDate: isoDate,
    })
    .passthrough(),
  deposits: z
    .object({
      customerId: identifier,
      depositTo: identifier,
      depositDate: isoDate,
      amount: positiveDecimal,
      currency: currencyCode,
    })
    .passthrough(),
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
  allocations: z
    .array(
      z.object({
        invoiceId: identifier,
        amount: positiveDecimal,
      }),
    )
    .min(1),
})

export const emailDocumentSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().max(5000).optional(),
})

export { decimalString }
