import { z } from "zod"
import {
  currencyCode,
  decimalString,
  identifier,
  isoDate,
  positiveDecimal,
  type OperationalSchema,
} from "./operational.js"

export const bankingSchemas: Record<string, OperationalSchema> = {
  accounts: z.object({
    accountName: z.string().min(1),
    accountType: z.enum(["bank", "cash", "credit-card", "mobile-money"]),
    currency: currencyCode,
    ledgerAccountId: identifier.optional(),
    openingBalance: decimalString.default("0"),
  }).passthrough(),
  "bank-feeds": z.object({
    account: identifier,
    transactionDate: isoDate,
    amount: decimalString,
    description: z.string().min(1),
    externalId: z.string().min(1),
  }).passthrough(),
  transactions: z.object({
    accountId: identifier,
    transactionDate: isoDate,
    amount: decimalString,
    description: z.string().optional(),
    type: z.enum(["deposit", "withdrawal", "fee", "interest", "other"]).optional(),
  }).passthrough(),
  "bank-rules": z.object({
    ruleName: z.string().min(1),
    account: identifier,
    condition: z.enum(["contains", "equals", "starts-with", "amount-greater-than", "amount-less-than"]),
    conditionValue: z.string().min(1),
    category: identifier,
  }).passthrough(),
  deposits: z.object({
    depositTo: identifier,
    depositDate: isoDate,
    payments: z.array(identifier).min(1),
    totalDeposit: positiveDecimal,
  }).passthrough(),
  reconciliation: z.object({
    accountId: identifier,
    statementDate: isoDate,
    beginningBalance: decimalString,
    endingBalance: decimalString,
    clearedTransactionIds: z.array(identifier).default([]),
  }).passthrough(),
  transfers: z.object({
    fromAccountId: identifier,
    toAccountId: identifier,
    transferDate: isoDate,
    amount: positiveDecimal,
    currency: currencyCode,
  }).passthrough().refine((value) => value.fromAccountId !== value.toAccountId, {
    message: "Source and destination accounts must be different",
  }),
  checks: z.object({
    bankAccount: identifier,
    payee: z.string().min(1),
    checkNumber: z.string().min(1),
    checkDate: isoDate,
    amount: positiveDecimal,
    currency: currencyCode,
  }).passthrough(),
  "cash-flow": z.object({
    name: z.string().min(1),
    startDate: isoDate,
    endDate: isoDate,
    assumptions: z.array(z.record(z.unknown())).default([]),
  }).passthrough(),
}

export const feedActionSchema = z.object({
  action: z.enum(["match", "add", "exclude"]),
  targetId: identifier.optional(),
  accountId: identifier.optional(),
}).refine((value) => value.action === "exclude" || value.targetId || value.accountId, {
  message: "Match/add actions require a targetId or accountId",
})

export const reconciliationFinishSchema = z.object({
  clearedTransactionIds: z.array(identifier).min(1),
  difference: decimalString.refine((value) => Number(value) === 0, "Reconciliation difference must be zero"),
})
