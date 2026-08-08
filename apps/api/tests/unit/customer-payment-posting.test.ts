import { describe, expect, it } from "vitest"
import { buildCustomerPaymentPosting } from "../../src/modules/sales/customer-payment-posting.js"

describe("customer payment posting adapter", () => {
  it("debits the configured deposit account and credits semantic AR for the full amount", () => {
    const command = buildCustomerPaymentPosting({
      paymentId: "50000000-0000-4000-8000-000000000001",
      paymentNumber: "PAY-00001",
      paymentDate: "2026-08-08",
      sourceVersion: 2,
      currency: "USD",
      exchangeRate: "1",
      amount: "125.5000",
      depositAccountId: "60000000-0000-4000-8000-000000000001",
      customerName: "Banaadir Trading",
      idempotencyKey: "payment-post-1",
    })
    expect(command).toMatchObject({
      sourceType: "customer_payment",
      sourceVersion: 2,
      postingKind: "primary",
      lines: [
        { accountId: "60000000-0000-4000-8000-000000000001", debit: "125.5000", credit: "0.0000" },
        { systemAccountKey: "accounts_receivable", debit: "0.0000", credit: "125.5000" },
      ],
    })
  })
})
