import { decimalToMinor, minorToDecimal } from "../accounting/ledger-math.js"
import { ledgerFamily } from "@blue-plastic/types"

/**
 * Pure arithmetic behind the balances shown in lists and on detail screens.
 * Everything works in minor units so no figure passes through a float.
 */

/** Families that increase with a debit. The rest increase with a credit. */
const debitNormal = new Set(["asset", "expense", "cost-of-goods-sold"])

/**
 * Signs a trial-balance row the way a bookkeeper reads it: a bank account with
 * money in it and a payable the company owes both come back positive.
 */
export function naturalBalance(
  accountType: string | undefined,
  debit: unknown,
  credit: unknown,
) {
  const difference = decimalToMinor(debit) - decimalToMinor(credit)
  const family = ledgerFamily(accountType)
  const normalized = debitNormal.has(family) ? difference : -difference
  return minorToDecimal(normalized)
}

export interface PartyDocument {
  /** Money still owed on the document. */
  outstanding: unknown
  /** Full value of the document, used for the total-billed figure. */
  total: unknown
  date: string
  dueDate?: string
  status: string
}

export interface PartyBalance {
  openBalance: string
  overdueBalance: string
  openCount: number
  lastDocumentDate?: string
}

/** Statuses that never sit in a receivable or payable balance. */
const settledStatuses = new Set(["void", "voided", "cancelled", "canceled"])

/**
 * Adds up what a customer or vendor still owes. Drafts are excluded because an
 * unposted document has not reached the subledger yet, and voided documents are
 * excluded because their reversal already removed them.
 */
export function summarizeParty(
  documents: PartyDocument[],
  asOf: string,
  options: { includeDrafts?: boolean } = {},
): PartyBalance {
  let openBalance = 0n
  let overdueBalance = 0n
  let openCount = 0
  let lastDocumentDate: string | undefined
  for (const document of documents) {
    const status = document.status.toLowerCase()
    if (settledStatuses.has(status)) continue
    if (status === "draft" && !options.includeDrafts) continue
    const outstanding = decimalToMinor(document.outstanding)
    const date = document.date.slice(0, 10)
    if (!lastDocumentDate || date > lastDocumentDate) lastDocumentDate = date
    if (outstanding <= 0n) continue
    openBalance += outstanding
    openCount += 1
    if (document.dueDate && document.dueDate.slice(0, 10) < asOf)
      overdueBalance += outstanding
  }
  return {
    openBalance: minorToDecimal(openBalance),
    overdueBalance: minorToDecimal(overdueBalance),
    openCount,
    ...(lastDocumentDate ? { lastDocumentDate } : {}),
  }
}

/**
 * The part of a payment that has not been applied to a document yet.
 *
 * Money applied to an invoice or a bill is already off that document's
 * outstanding amount, so counting it again would take it off the party balance
 * twice. Only the remainder is a credit the party still holds.
 */
export function unappliedAmount(amount: unknown, allocations: unknown) {
  const paid = decimalToMinor(amount)
  const applied = Array.isArray(allocations)
    ? allocations.reduce<bigint>(
        (total, allocation) =>
          total +
          decimalToMinor(
            (allocation as { amount?: unknown } | null)?.amount ?? "0",
          ),
        0n,
      )
    : 0n
  const remaining = paid - applied
  return minorToDecimal(remaining > 0n ? remaining : 0n)
}

/**
 * What a document still owes once the payments applied to it are taken off.
 *
 * A document whose own outstanding amount was updated when the payment landed
 * already shows the lower figure; one whose amount was not updated is corrected
 * here. Taking the smaller of the two keeps both cases from double counting.
 */
export function outstandingAfterAllocations(
  outstanding: unknown,
  total: unknown,
  allocated: unknown,
) {
  const recorded = decimalToMinor(outstanding)
  const afterAllocations = decimalToMinor(total) - decimalToMinor(allocated)
  const lower = afterAllocations < recorded ? afterAllocations : recorded
  return minorToDecimal(lower > 0n ? lower : 0n)
}

/**
 * Takes unapplied payments off a party balance.
 *
 * An unapplied receipt is treated the way a bookkeeper treats one: it reduces
 * what the party owes, oldest debt first, and it can leave the party in credit.
 * Overdue is reduced along with it but never falls below zero.
 */
export function netPayments(
  balance: PartyBalance,
  payments: unknown[],
): PartyBalance {
  const paid = payments.reduce<bigint>(
    (total, payment) => total + decimalToMinor(payment),
    0n,
  )
  if (paid === 0n) return balance
  const open = decimalToMinor(balance.openBalance) - paid
  const overdue = decimalToMinor(balance.overdueBalance) - paid
  return {
    ...balance,
    openBalance: minorToDecimal(open),
    overdueBalance: minorToDecimal(overdue > 0n ? overdue : 0n),
  }
}

/** Weighted average cost carried by the stock on hand. */
export function averageCost(quantity: unknown, inventoryValue: unknown) {
  const units = decimalToMinor(quantity)
  if (units === 0n) return "0.0000"
  return minorToDecimal((decimalToMinor(inventoryValue) * 10_000n) / units)
}

export function addDecimals(left: unknown, right: unknown) {
  return minorToDecimal(decimalToMinor(left) + decimalToMinor(right))
}

/**
 * Walks ledger lines oldest to newest and carries the balance after each one,
 * signed by the account family so the column reads like an account register.
 */
export function runningLedgerBalance(
  accountType: string | undefined,
  lines: Array<{ debit: unknown; credit: unknown }>,
) {
  const sign = debitNormal.has(ledgerFamily(accountType)) ? 1n : -1n
  let carried = 0n
  return lines.map((line) => {
    carried += sign * (decimalToMinor(line.debit) - decimalToMinor(line.credit))
    return minorToDecimal(carried)
  })
}
