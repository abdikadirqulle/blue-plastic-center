import { z } from "zod"
import {
  decimalString,
  identifier,
  isoDate,
  positiveDecimal,
  type OperationalSchema,
} from "../operations/operational.schemas.js"
import { decimalToMinor } from "../accounting/ledger-math.js"

const payRunLine = z
  .object({
    employeeId: identifier,
    grossPay: positiveDecimal,
    deductions: decimalString.default("0"),
    netPay: positiveDecimal,
  })
  .refine(
    (line) =>
      decimalToMinor(line.grossPay) - decimalToMinor(line.deductions) ===
      decimalToMinor(line.netPay),
    {
      message: "Net pay must equal gross pay minus deductions",
      path: ["netPay"],
    },
  )

export const payrollSchemas: Record<string, OperationalSchema> = {
  "pay-runs": z
    .object({
      periodStart: isoDate,
      periodEnd: isoDate,
      paymentDate: isoDate,
      currency: z.string().length(3).default("USD"),
      lines: z.array(payRunLine).min(1),
      wageExpenseAccountId: identifier,
      payrollPayableAccountId: identifier,
    })
    .passthrough()
    .refine(
      (payRun) =>
        payRun.periodStart <= payRun.periodEnd &&
        payRun.paymentDate >= payRun.periodEnd,
      { message: "Pay-run period and payment dates are invalid" },
    ),
  employees: z
    .object({
      employeeId: z.string().min(1),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email().optional(),
      hireDate: isoDate,
      salary: decimalString.optional(),
      active: z.boolean().default(true),
    })
    .passthrough(),
  timesheets: z
    .object({
      employeeId: identifier,
      weekStart: isoDate,
      hours: positiveDecimal,
      projectId: identifier.optional(),
      approved: z.boolean().default(false),
    })
    .passthrough(),
  leave: z
    .object({
      employeeId: identifier,
      leaveType: z.string().min(1),
      startDate: isoDate,
      endDate: isoDate,
      days: positiveDecimal,
    })
    .passthrough(),
  loans: z
    .object({
      employeeId: identifier,
      principal: positiveDecimal,
      startDate: isoDate,
      installmentAmount: positiveDecimal,
      outstandingBalance: decimalString,
    })
    .passthrough(),
  liabilities: z
    .object({
      liabilityType: z.string().min(1),
      agency: z.string().min(1),
      dueDate: isoDate,
      periodFrom: isoDate,
      periodTo: isoDate,
      amount: positiveDecimal,
      payrollRuns: z.array(identifier).min(1),
    })
    .passthrough(),
  benefits: z
    .object({
      benefitName: z.string().min(1),
      benefitType: z.string().min(1),
      effectiveDate: isoDate,
      eligibility: z.string().min(1),
      calculation: z.record(z.unknown()),
      accounts: z.record(identifier),
    })
    .passthrough(),
  reports: z
    .object({
      reportType: z.string().min(1),
      dateFrom: isoDate,
      dateTo: isoDate,
    })
    .passthrough(),
}
