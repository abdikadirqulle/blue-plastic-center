import "dotenv/config"
import { inArray, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createDatabase, type Database } from "../../src/db/client.js"
import {
  accountingLines,
  accountingTransactions,
  accounts,
  auditEvents,
  branches,
  companies,
  customerPaymentAllocations,
  customerPayments,
  customers,
  fiscalPeriods,
  idempotencyKeys,
  invoices,
  items,
  postingIdempotencyKeys,
  documentSequences,
  users,
} from "../../src/db/schema.js"
import { createBalancedJournalEntry } from "../../src/modules/accounting/posting-engine.js"
import { PostgresLedgerRepository } from "../../src/modules/accounting/postgres-ledger-repository.js"
import { systemAccountKeys } from "../../src/modules/accounting/system-accounts.js"
import { PostgresInventoryMovements } from "../../src/modules/inventory/postgres-inventory-movements.js"
import { reconcileAccountsReceivable } from "../../src/modules/sales/ar-reconciliation.js"
import { PostgresCustomerPaymentRepository } from "../../src/modules/sales/postgres-customer-payment-repository.js"
import { PostgresInvoiceRepository } from "../../src/modules/sales/postgres-invoice-repository.js"
import type { RequestContext } from "../../src/platform/types.js"

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL)
const postgresDescribe = enabled ? describe.sequential : describe.skip

const companyId = "f4000000-0000-4000-8000-000000000001"
const otherCompanyId = "f4000000-0000-4000-8000-000000000002"
const branchId = "f4100000-0000-4000-8000-000000000001"
const otherBranchId = "f4100000-0000-4000-8000-000000000002"
const userId = "f4200000-0000-4000-8000-000000000001"
const otherUserId = "f4200000-0000-4000-8000-000000000002"
const customerId = "f4300000-0000-4000-8000-000000000001"
const otherCustomerId = "f4300000-0000-4000-8000-000000000002"
const bankId = "f4400000-0000-4000-8000-000000000001"
const arId = "f4400000-0000-4000-8000-000000000002"
const revenueId = "f4400000-0000-4000-8000-000000000003"
const otherBankId = "f4400000-0000-4000-8000-000000000011"
const otherArId = "f4400000-0000-4000-8000-000000000012"
const otherRevenueId = "f4400000-0000-4000-8000-000000000013"
const itemId = "f4500000-0000-4000-8000-000000000001"
const otherItemId = "f4500000-0000-4000-8000-000000000002"

const context: RequestContext = {
  requestId: "phase-3f-ar-recon",
  companyId,
  branchId,
  principal: { userId, name: "Phase 3F", role: "administrator" },
}
const otherContext: RequestContext = {
  requestId: "phase-3f-ar-recon-other",
  companyId: otherCompanyId,
  branchId: otherBranchId,
  principal: { userId: otherUserId, name: "Phase 3F Other", role: "administrator" },
}

async function cleanup(db: Database) {
  const companyIds = [companyId, otherCompanyId]
  await db.transaction(async (tx) => {
    await tx.delete(auditEvents).where(inArray(auditEvents.companyId, companyIds))
    await tx.delete(accountingLines).where(inArray(
      accountingLines.transactionId,
      tx.select({ id: accountingTransactions.id }).from(accountingTransactions)
        .where(inArray(accountingTransactions.companyId, companyIds)),
    ))
    await tx.delete(postingIdempotencyKeys).where(inArray(postingIdempotencyKeys.companyId, companyIds))
    await tx.delete(accountingTransactions).where(inArray(accountingTransactions.companyId, companyIds))
    await tx.delete(idempotencyKeys).where(inArray(idempotencyKeys.companyId, companyIds))
    await tx.execute(sql`delete from customer_payment_allocations where payment_id in (
      select id from customer_payments where company_id in (${companyId}, ${otherCompanyId})
    )`)
    await tx.delete(customerPayments).where(inArray(customerPayments.companyId, companyIds))
    await tx.execute(sql`delete from invoice_lines where invoice_id in (
      select id from invoices where company_id in (${companyId}, ${otherCompanyId})
    )`)
    await tx.delete(invoices).where(inArray(invoices.companyId, companyIds))
    await tx.delete(items).where(inArray(items.companyId, companyIds))
    await tx.delete(customers).where(inArray(customers.companyId, companyIds))
    await tx.delete(fiscalPeriods).where(inArray(fiscalPeriods.companyId, companyIds))
    await tx.delete(documentSequences).where(inArray(documentSequences.companyId, companyIds))
    await tx.delete(accounts).where(inArray(accounts.companyId, companyIds))
    await tx.delete(users).where(inArray(users.companyId, companyIds))
    await tx.delete(branches).where(inArray(branches.companyId, companyIds))
    await tx.delete(companies).where(inArray(companies.id, companyIds))
  })
}

postgresDescribe("AR subledger ↔ GL reconciliation exit gate", () => {
  let database: ReturnType<typeof createDatabase>
  let db: Database
  let ledger: PostgresLedgerRepository
  let invoicesRepo: PostgresInvoiceRepository
  let payments: PostgresCustomerPaymentRepository

  beforeAll(async () => {
    database = createDatabase(process.env.DATABASE_URL!)
    db = database.db
    ledger = new PostgresLedgerRepository(db)
    invoicesRepo = new PostgresInvoiceRepository(db, ledger, new PostgresInventoryMovements(db))
    payments = new PostgresCustomerPaymentRepository(db, ledger)
    await cleanup(db)

    await db.insert(companies).values([
      { id: companyId, legalName: "Phase 3F Company", functionalCurrency: "USD" },
      { id: otherCompanyId, legalName: "Phase 3F Other", functionalCurrency: "USD" },
    ])
    await db.insert(branches).values([
      { id: branchId, companyId, name: "Main", code: "MAIN" },
      { id: otherBranchId, companyId: otherCompanyId, name: "Other", code: "OTH" },
    ])
    await db.insert(users).values([
      {
        id: userId, companyId, username: "phase3f", email: "phase3f@test.invalid",
        displayName: "Phase 3F", role: "administrator",
      },
      {
        id: otherUserId, companyId: otherCompanyId, username: "phase3f-other",
        email: "phase3f-other@test.invalid", displayName: "Phase 3F Other", role: "administrator",
      },
    ])
    await db.insert(accounts).values([
      {
        id: bankId, companyId, accountNumber: "1020", name: "Bank", type: "asset",
        normalBalance: "debit", systemKey: systemAccountKeys.BANK,
      },
      {
        id: arId, companyId, accountNumber: "1100", name: "Accounts Receivable", type: "asset",
        normalBalance: "debit", systemKey: systemAccountKeys.ACCOUNTS_RECEIVABLE,
        isControlAccount: true, allowManualPosting: false,
      },
      {
        id: revenueId, companyId, accountNumber: "4000", name: "Service Revenue", type: "income",
        normalBalance: "credit", systemKey: systemAccountKeys.SERVICE_REVENUE,
      },
      {
        id: otherBankId, companyId: otherCompanyId, accountNumber: "1020", name: "Bank",
        type: "asset", normalBalance: "debit", systemKey: systemAccountKeys.BANK,
      },
      {
        id: otherArId, companyId: otherCompanyId, accountNumber: "1100", name: "Accounts Receivable",
        type: "asset", normalBalance: "debit", systemKey: systemAccountKeys.ACCOUNTS_RECEIVABLE,
        isControlAccount: true, allowManualPosting: false,
      },
      {
        id: otherRevenueId, companyId: otherCompanyId, accountNumber: "4000", name: "Service Revenue",
        type: "income", normalBalance: "credit", systemKey: systemAccountKeys.SERVICE_REVENUE,
      },
    ])
    await db.insert(customers).values([
      {
        id: customerId, companyId, branchId, displayName: "Reconcile Customer",
        receivableAccountId: arId, createdBy: userId, updatedBy: userId,
      },
      {
        id: otherCustomerId, companyId: otherCompanyId, branchId: otherBranchId,
        displayName: "Other Customer", receivableAccountId: otherArId,
        createdBy: otherUserId, updatedBy: otherUserId,
      },
    ])
    await db.insert(items).values([
      {
        id: itemId, companyId, sku: "SVC-3F", name: "Consulting", type: "service",
        salesPrice: "1000.0000", incomeAccountId: revenueId,
        createdBy: userId, updatedBy: userId,
      },
      {
        id: otherItemId, companyId: otherCompanyId, sku: "SVC-3F-O", name: "Other Service",
        type: "service", salesPrice: "500.0000", incomeAccountId: otherRevenueId,
        createdBy: otherUserId, updatedBy: otherUserId,
      },
    ])
    await db.insert(fiscalPeriods).values([
      {
        companyId, name: "August 2027", startDate: new Date("2027-08-01T00:00:00Z"),
        endDate: new Date("2027-08-31T23:59:59Z"), status: "open",
      },
      {
        companyId: otherCompanyId, name: "August 2027",
        startDate: new Date("2027-08-01T00:00:00Z"),
        endDate: new Date("2027-08-31T23:59:59Z"), status: "open",
      },
    ])
  })

  afterAll(async () => {
    if (db) await cleanup(db)
    if (database) await database.close()
  })

  it("keeps AR subledger and AR GL reconciled through invoice, payment, and reversal", async () => {
    const invoice = await invoicesRepo.create(context, {
      status: "draft",
      data: {
        customerId,
        invoiceDate: "2027-08-01",
        dueDate: "2027-08-31",
        currency: "USD",
        lines: [{
          itemId,
          description: "Consulting",
          quantity: "1",
          unitPrice: "1000.00",
        }],
      },
    })
    await invoicesRepo.post(context, invoice.id, `phase-3f-invoice-post-${invoice.id}`)

    let recon = await reconcileAccountsReceivable(db, companyId)
    expect(recon).toMatchObject({
      subledgerBalance: "1000.0000",
      glBalance: "1000.0000",
      difference: "0.0000",
      isReconciled: true,
    })

    const payment = await payments.create(context, {
      customerId,
      paymentDate: "2027-08-15",
      amount: "400.00",
      currency: "USD",
      depositToAccountId: bankId,
      paymentMethod: "bank-transfer",
      allocations: [{ invoiceId: invoice.id, amount: "400.00" }],
    })
    await payments.post(context, payment.id, `phase-3f-payment-post-${payment.id}`)

    recon = await reconcileAccountsReceivable(db, companyId)
    expect(recon).toMatchObject({
      subledgerBalance: "600.0000",
      glBalance: "600.0000",
      difference: "0.0000",
      isReconciled: true,
    })

    await payments.reverse(
      context,
      payment.id,
      { reason: "Phase 3F reverse", reversalDate: "2027-08-20" },
      `phase-3f-payment-reverse-${payment.id}`,
    )

    recon = await reconcileAccountsReceivable(db, companyId)
    expect(recon).toMatchObject({
      subledgerBalance: "1000.0000",
      glBalance: "1000.0000",
      difference: "0.0000",
      isReconciled: true,
    })
  }, 120_000)

  it("isolates companies and detects an exact unrepaired mismatch", async () => {
    const otherInvoice = await invoicesRepo.create(otherContext, {
      status: "draft",
      data: {
        customerId: otherCustomerId,
        invoiceDate: "2027-08-01",
        dueDate: "2027-08-31",
        currency: "USD",
        lines: [{
          itemId: otherItemId,
          description: "Other consulting",
          quantity: "1",
          unitPrice: "500.00",
        }],
      },
    })
    await invoicesRepo.post(
      otherContext,
      otherInvoice.id,
      `phase-3f-other-invoice-${otherInvoice.id}`,
    )

    const before = await reconcileAccountsReceivable(db, companyId)
    expect(before.isReconciled).toBe(true)

    await ledger.post(context, createBalancedJournalEntry({
      sourceModule: "sales",
      sourceType: "ar_recon_probe",
      sourceId: "f4600000-0000-4000-8000-000000000001",
      postingKind: "primary",
      idempotencyKey: "phase-3f-deliberate-mismatch",
      transactionDate: "2027-08-21",
      currency: "USD",
      exchangeRate: "1",
      memo: "Deliberate AR mismatch probe",
      lines: [
        {
          accountId: arId,
          description: "Unmatched AR debit",
          debit: "25.0000",
          credit: "0",
        },
        {
          accountId: revenueId,
          description: "Unmatched revenue credit",
          debit: "0",
          credit: "25.0000",
        },
      ],
    }))

    const mismatched = await reconcileAccountsReceivable(db, companyId)
    expect(mismatched).toMatchObject({
      subledgerBalance: "1000.0000",
      glBalance: "1025.0000",
      difference: "-25.0000",
      isReconciled: false,
    })

    const other = await reconcileAccountsReceivable(db, otherCompanyId)
    expect(other).toMatchObject({
      subledgerBalance: "500.0000",
      glBalance: "500.0000",
      difference: "0.0000",
      isReconciled: true,
    })
  }, 120_000)
})
