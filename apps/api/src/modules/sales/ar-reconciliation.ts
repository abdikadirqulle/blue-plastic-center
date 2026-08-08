import { and, eq, inArray, isNull, notInArray, sql } from "drizzle-orm"
import type { Database } from "../../db/client.js"
import {
  accountingLines,
  accountingTransactions,
  customerPaymentAllocations,
  customerPayments,
  invoices,
} from "../../db/schema.js"
import { createPostgresAccountResolver } from "../accounting/account-resolver.js"
import {
  addMoney,
  compareMoney,
  formatMoney,
  parseMoney,
  subtractMoney,
} from "../accounting/money.js"
import { systemAccountKeys } from "../accounting/system-accounts.js"
import { calculateInvoiceSettlement } from "./invoice-settlement.js"

export interface ArReconciliationResult {
  companyId: string
  subledgerBalance: string
  glBalance: string
  difference: string
  isReconciled: boolean
}

/** Exact difference = subledger − GL; reconciled only when difference is zero. */
export function buildArReconciliationResult(input: {
  companyId: string
  subledgerBalance: string
  glBalance: string
}): ArReconciliationResult {
  const subledgerBalance = formatMoney(parseMoney(input.subledgerBalance))
  const glBalance = formatMoney(parseMoney(input.glBalance))
  const difference = formatMoney(
    subtractMoney(parseMoney(subledgerBalance), parseMoney(glBalance)),
  )
  return {
    companyId: input.companyId,
    subledgerBalance,
    glBalance,
    difference,
    isReconciled: compareMoney(parseMoney(difference), parseMoney("0")) === 0,
  }
}

/**
 * Company AR control reconciliation:
 * sum(canonical balanceDue of eligible posted invoices)
 *   vs
 * Accounts Receivable control account (debits − credits).
 */
export async function reconcileAccountsReceivable(
  db: Database,
  companyId: string,
): Promise<ArReconciliationResult> {
  return db.transaction(async (transaction) => {
    const arAccount = await createPostgresAccountResolver(transaction)
      .resolveMeaning(companyId, systemAccountKeys.ACCOUNTS_RECEIVABLE)

    const [gl] = await transaction
      .select({
        balance: sql<string>`(
          coalesce(sum(${accountingLines.debit}), 0)
          - coalesce(sum(${accountingLines.credit}), 0)
        )::text`,
      })
      .from(accountingLines)
      .innerJoin(
        accountingTransactions,
        eq(accountingLines.transactionId, accountingTransactions.id),
      )
      .where(and(
        eq(accountingTransactions.companyId, companyId),
        eq(accountingLines.accountId, arAccount.id),
        inArray(accountingTransactions.status, ["posted", "reversed"]),
      ))

    const eligible = await transaction
      .select({
        id: invoices.id,
        status: invoices.status,
        total: invoices.total,
      })
      .from(invoices)
      .where(and(
        eq(invoices.companyId, companyId),
        eq(invoices.isDeleted, false),
        isNull(invoices.deletedAt),
        notInArray(invoices.status, ["draft", "voided"]),
      ))

    let subledger = parseMoney("0")
    if (eligible.length) {
      const totals = await transaction
        .select({
          invoiceId: customerPaymentAllocations.invoiceId,
          total: sql<string>`coalesce(sum(${customerPaymentAllocations.amount}), 0)::text`,
        })
        .from(customerPaymentAllocations)
        .innerJoin(
          customerPayments,
          eq(customerPaymentAllocations.paymentId, customerPayments.id),
        )
        .where(and(
          inArray(customerPaymentAllocations.invoiceId, eligible.map((row) => row.id)),
          eq(customerPayments.companyId, companyId),
          eq(customerPayments.status, "posted"),
          eq(customerPayments.isDeleted, false),
          isNull(customerPayments.deletedAt),
        ))
        .groupBy(customerPaymentAllocations.invoiceId)
      const byInvoice = new Map(totals.map((row) => [row.invoiceId, row.total]))
      for (const invoice of eligible) {
        const settlement = calculateInvoiceSettlement({
          invoiceStatus: invoice.status,
          total: invoice.total,
          postedAllocationTotal: byInvoice.get(invoice.id) ?? "0",
        })
        subledger = addMoney(subledger, parseMoney(settlement.balanceDue))
      }
    }

    return buildArReconciliationResult({
      companyId,
      subledgerBalance: formatMoney(subledger),
      glBalance: formatMoney(parseMoney(gl?.balance ?? "0")),
    })
  })
}
