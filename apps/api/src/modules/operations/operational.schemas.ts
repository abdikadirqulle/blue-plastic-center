import { z } from "zod"

export const decimalString = z.string().regex(/^-?\d+(\.\d{1,8})?$/, "Must be a decimal string")
export const positiveDecimal = decimalString.refine((value) => Number(value) > 0, "Must be greater than zero")
export const currencyCode = z.string().length(3).transform((value) => value.toUpperCase())
export const identifier = z.string().min(1).max(100)
export const isoDate = z.string().date()

export const transactionLineSchema = z.object({
  itemId: identifier.optional(),
  accountId: identifier.optional(),
  description: z.string().trim().min(1).max(500),
  quantity: positiveDecimal.default("1"),
  unitPrice: decimalString.default("0"),
  taxCodeId: identifier.optional(),
  discountRate: decimalString.optional(),
  warehouseId: identifier.optional(),
}).refine((line) => line.itemId || line.accountId, {
  message: "Each line requires an itemId or accountId",
})

export const transactionLines = z.array(transactionLineSchema).min(1).max(500)

export const partySchema = z.object({
  displayName: z.string().trim().min(2).max(200),
  companyName: z.string().trim().max(200).optional(),
  email: z.string().email().optional(),
  phone: z.string().trim().max(50).optional(),
  currency: currencyCode.default("USD"),
  paymentTermId: identifier.optional(),
  openingBalance: decimalString.default("0"),
}).passthrough()

export const documentBase = z.object({
  currency: currencyCode,
  exchangeRate: positiveDecimal.default("1"),
  reference: z.string().trim().max(100).optional(),
  memo: z.string().trim().max(2000).optional(),
  lines: transactionLines,
}).passthrough()

export type OperationalSchema = z.ZodType<Record<string, unknown>>
