import { z } from "zod"
import { decimalString, identifier, isoDate, type OperationalSchema } from "./operational.js"

const journalLine = z.object({
  accountId: identifier,
  description: z.string().max(500).optional(),
  debit: decimalString.default("0"),
  credit: decimalString.default("0"),
  classId: identifier.optional(),
  projectId: identifier.optional(),
})

export const accountingSchemas: Record<string, OperationalSchema> = {
  "chart-of-accounts": z.object({
    accountNumber: z.string().min(1),
    accountName: z.string().min(1),
    accountType: z.enum(["asset", "liability", "equity", "income", "expense", "cost-of-goods-sold"]),
    parentId: identifier.optional(),
    currency: z.string().length(3).default("USD"),
  }).passthrough(),
  "journal-entries": z.object({
    journalDate: isoDate,
    currency: z.string().length(3).default("USD"),
    exchangeRate: decimalString.default("1"),
    memo: z.string().max(2000).optional(),
    sourceModule: z.string().optional(),
    sourceId: identifier.optional(),
    reversalOfId: identifier.optional(),
    lines: z.array(journalLine).min(2).max(1000),
  }).passthrough(),
  registers: z.object({
    accountId: identifier,
    transactionDate: isoDate,
    amount: decimalString,
    reference: z.string().optional(),
  }).passthrough(),
  recurring: z.object({
    name: z.string().min(1),
    transactionType: z.string().min(1),
    frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
    nextRunDate: isoDate,
    template: z.record(z.unknown()),
  }).passthrough(),
  "fiscal-periods": z.object({
    name: z.string().min(1),
    startDate: isoDate,
    endDate: isoDate,
    status: z.enum(["open", "closed", "locked"]).default("open"),
  }).passthrough().refine(
    (value) => value.startDate <= value.endDate,
    { message: "Period dates are invalid" },
  ),
  "close-center": z.object({
    period: z.string().min(1),
    closeDate: isoDate,
    owner: identifier,
    checklist: z.array(z.object({
      name: z.string().min(1),
      completed: z.boolean(),
    })).min(1),
  }).passthrough(),
  budgets: z.object({
    budgetName: z.string().min(1),
    fiscalYear: z.number().int().min(2000).max(2200),
    budgetType: z.enum(["budget", "forecast"]),
    scenario: z.string().min(1),
    monthlyValues: z.array(decimalString).length(12),
  }).passthrough(),
  "fixed-assets": z.object({
    assetName: z.string().min(1),
    assetNumber: z.string().min(1),
    category: z.string().min(1),
    purchaseDate: isoDate,
    inServiceDate: isoDate,
    cost: decimalString,
    usefulLife: z.number().int().positive(),
    method: z.enum(["straight-line", "declining-balance", "units-of-production"]),
    accumulatedDepreciation: decimalString.default("0"),
  }).passthrough(),
  classes: z.object({
    className: z.string().min(1),
    parentId: identifier.optional(),
    active: z.boolean().default(true),
  }).passthrough(),
  "audit-log": z.object({
    action: z.string().min(1),
    entityType: z.string().min(1),
    entityId: identifier,
  }).passthrough(),
}

export const reverseJournalSchema = z.object({
  reversalDate: isoDate,
  memo: z.string().max(2000).optional(),
})

export const periodSchema = z.object({
  name: z.string().min(1),
  startDate: isoDate,
  endDate: isoDate,
}).refine((value) => value.startDate <= value.endDate, { message: "Period dates are invalid" })

export const reconciliationSchema = z.object({
  from: isoDate,
  to: isoDate,
}).refine((value) => value.from <= value.to, {
  message: "Reconciliation dates are invalid",
})
