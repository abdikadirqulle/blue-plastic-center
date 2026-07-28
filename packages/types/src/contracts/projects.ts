import { z } from "zod"
import { currencyCode, decimalString, identifier, isoDate, positiveDecimal, type OperationalSchema } from "./operational.js"

export const projectSchemas: Record<string, OperationalSchema> = {
  projects: z.object({
    projectName: z.string().min(1),
    customerId: identifier,
    startDate: isoDate,
    endDate: isoDate.optional(),
    contractAmount: decimalString.default("0"),
    currency: currencyCode.default("USD"),
    projectManagerId: identifier.optional(),
  }).passthrough(),
  tasks: z.object({
    taskName: z.string().min(1),
    projectId: identifier,
    startDate: isoDate.optional(),
    dueDate: isoDate.optional(),
    budgetHours: decimalString.optional(),
  }).passthrough(),
  time: z.object({
    employeeId: identifier,
    projectId: identifier,
    taskId: identifier.optional(),
    date: isoDate,
    hours: positiveDecimal,
    hourlyCost: decimalString.default("0"),
    billable: z.boolean().default(false),
  }).passthrough(),
  expenses: z.object({
    projectId: identifier,
    date: isoDate,
    amount: positiveDecimal,
    accountId: identifier,
    billable: z.boolean().default(false),
    description: z.string().optional(),
  }).passthrough(),
  "progress-billing": z.object({
    projectId: identifier,
    customerId: identifier,
    invoiceDate: isoDate,
    amount: positiveDecimal,
    revenueAccountId: identifier,
    description: z.string().min(1),
  }).passthrough(),
  "change-orders": z.object({
    project: identifier,
    changeNumber: z.string().min(1),
    changeDate: isoDate,
    reason: z.string().min(1),
    amount: decimalString,
    scope: z.string().min(1),
  }).passthrough(),
  profitability: z.object({
    projectId: identifier,
    dateFrom: isoDate,
    dateTo: isoDate,
  }).passthrough(),
}

export const progressBillingSchema = z.object({
  dueDate: isoDate,
  receivableAccountId: identifier,
})
