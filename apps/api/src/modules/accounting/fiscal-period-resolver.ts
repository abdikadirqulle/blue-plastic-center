import { and, eq, gte, lte } from "drizzle-orm"
import type { DatabaseTransaction } from "../../db/client.js"
import { fiscalPeriods } from "../../db/schema.js"
import { conflict } from "../../platform/errors.js"

export interface FiscalPeriodCandidate {
  id: string
  companyId: string
  name: string
  startDate: Date
  endDate: Date
  status: string
}

export function requireExactlyOneOpenFiscalPeriod(
  periods: FiscalPeriodCandidate[],
  companyId: string,
  transactionDate: Date,
) {
  const matches = periods.filter((period) =>
    period.companyId === companyId &&
    period.startDate <= transactionDate &&
    period.endDate >= transactionDate
  )

  if (matches.length === 0) {
    throw conflict("No fiscal period exists for the transaction date")
  }
  if (matches.length > 1) {
    throw conflict("Multiple fiscal periods match the transaction date")
  }
  if (matches[0].status !== "open") {
    throw conflict(`Fiscal period ${matches[0].name} is not open`)
  }
  return matches[0]
}

/** Resolves a posting date without allowing a query limit to hide overlaps. */
export async function resolveOpenFiscalPeriod(
  transaction: DatabaseTransaction,
  companyId: string,
  transactionDate: Date,
) {
  const matches = await transaction
    .select({
      id: fiscalPeriods.id,
      companyId: fiscalPeriods.companyId,
      name: fiscalPeriods.name,
      startDate: fiscalPeriods.startDate,
      endDate: fiscalPeriods.endDate,
      status: fiscalPeriods.status,
    })
    .from(fiscalPeriods)
    .where(and(
      eq(fiscalPeriods.companyId, companyId),
      lte(fiscalPeriods.startDate, transactionDate),
      gte(fiscalPeriods.endDate, transactionDate),
    ))

  return requireExactlyOneOpenFiscalPeriod(matches, companyId, transactionDate)
}
