import { createBalancedJournalEntry } from "../accounting/posting-engine.js"
import { systemAccountKeys } from "../accounting/system-accounts.js"

export interface CustomerPaymentPostingInput {
  paymentId: string
  paymentNumber: string
  paymentDate: string
  sourceVersion: number
  currency: string
  exchangeRate: string
  amount: string
  depositAccountId: string
  customerName: string
  receivableAccountId?: string
  idempotencyKey: string
}

/** Full receipt posts to cash/bank and AR, including any unapplied customer credit. */
export function buildCustomerPaymentPosting(input: CustomerPaymentPostingInput) {
  return createBalancedJournalEntry({
    sourceModule: "sales",
    sourceType: "customer_payment",
    sourceId: input.paymentId,
    sourceVersion: input.sourceVersion,
    postingKind: "primary",
    idempotencyKey: input.idempotencyKey,
    transactionDate: input.paymentDate,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
    memo: `Customer payment ${input.paymentNumber}`,
    lines: [
      {
        accountId: input.depositAccountId,
        description: `Payment received — ${input.customerName}`,
        debit: input.amount,
        credit: "0",
      },
      {
        ...(input.receivableAccountId
          ? { accountId: input.receivableAccountId }
          : { systemAccountKey: systemAccountKeys.ACCOUNTS_RECEIVABLE }),
        description: `Accounts receivable — ${input.customerName}`,
        debit: "0",
        credit: input.amount,
      },
    ],
  })
}
