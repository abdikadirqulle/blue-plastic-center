import "dotenv/config"
import { and, eq, inArray, sql } from "drizzle-orm"
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
  invoices,
  postingIdempotencyKeys,
  users,
} from "../../src/db/schema.js"
import { PostgresLedgerRepository } from "../../src/modules/accounting/postgres-ledger-repository.js"
import { systemAccountKeys } from "../../src/modules/accounting/system-accounts.js"
import { PostgresInventoryMovements } from "../../src/modules/inventory/postgres-inventory-movements.js"
import { PostgresCustomerPaymentRepository } from "../../src/modules/sales/postgres-customer-payment-repository.js"
import { PostgresInvoiceRepository } from "../../src/modules/sales/postgres-invoice-repository.js"
import type { RequestContext } from "../../src/platform/types.js"

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL)
const postgresDescribe = enabled ? describe.sequential : describe.skip

const companyId = "f3000000-0000-4000-8000-000000000001"
const branchId = "f3100000-0000-4000-8000-000000000001"
const userId = "f3200000-0000-4000-8000-000000000001"
const customerId = "f3300000-0000-4000-8000-000000000001"
const bankId = "f3400000-0000-4000-8000-000000000001"
const arId = "f3400000-0000-4000-8000-000000000002"
const ids = (prefix: string, suffix: number) =>
  `${prefix}00000-0000-4000-8000-${String(suffix).padStart(12, "0")}`

const context: RequestContext = {
  requestId: "phase-3c-postgres",
  companyId,
  branchId,
  principal: { userId, name: "Phase 3C", role: "administrator" },
}

async function cleanup(db: Database) {
  await db.transaction(async (tx) => {
    await tx.delete(auditEvents).where(eq(auditEvents.companyId, companyId))
    await tx.delete(accountingLines).where(inArray(
      accountingLines.transactionId,
      tx.select({ id: accountingTransactions.id }).from(accountingTransactions)
        .where(eq(accountingTransactions.companyId, companyId)),
    ))
    await tx.delete(postingIdempotencyKeys).where(eq(postingIdempotencyKeys.companyId, companyId))
    await tx.delete(accountingTransactions).where(eq(accountingTransactions.companyId, companyId))
    await tx.execute(sql`delete from customer_payment_allocations where payment_id in (
      select id from customer_payments where company_id = ${companyId}
    )`)
    await tx.delete(customerPayments).where(eq(customerPayments.companyId, companyId))
    await tx.delete(invoices).where(eq(invoices.companyId, companyId))
    await tx.delete(customers).where(eq(customers.companyId, companyId))
    await tx.delete(fiscalPeriods).where(eq(fiscalPeriods.companyId, companyId))
    await tx.delete(accounts).where(eq(accounts.companyId, companyId))
    await tx.delete(users).where(eq(users.companyId, companyId))
    await tx.delete(branches).where(eq(branches.companyId, companyId))
    await tx.delete(companies).where(eq(companies.id, companyId))
  })
}

postgresDescribe("customer payment PostgreSQL atomic posting", () => {
  let database: ReturnType<typeof createDatabase>
  let db: Database
  let repository: PostgresCustomerPaymentRepository
  let invoiceRepository: PostgresInvoiceRepository

  beforeAll(async () => {
    database = createDatabase(process.env.DATABASE_URL!)
    db = database.db
    const ledger = new PostgresLedgerRepository(db)
    repository = new PostgresCustomerPaymentRepository(db, ledger)
    invoiceRepository = new PostgresInvoiceRepository(db, ledger, new PostgresInventoryMovements(db))
    await cleanup(db)
    await db.insert(companies).values({ id: companyId, legalName: "Phase 3C Company", functionalCurrency: "USD" })
    await db.insert(branches).values({ id: branchId, companyId, name: "Main", code: "MAIN" })
    await db.insert(users).values({
      id: userId, companyId, username: "phase3c", email: "phase3c@test.invalid",
      displayName: "Phase 3C", role: "administrator",
    })
    await db.insert(accounts).values([
      { id: bankId, companyId, accountNumber: "1020", name: "Bank", type: "asset", normalBalance: "debit", systemKey: systemAccountKeys.BANK },
      { id: arId, companyId, accountNumber: "1100", name: "Accounts Receivable", type: "asset", normalBalance: "debit", systemKey: systemAccountKeys.ACCOUNTS_RECEIVABLE },
    ])
    await db.insert(customers).values({
      id: customerId, companyId, branchId, displayName: "Atomic Customer",
      receivableAccountId: arId, createdBy: userId, updatedBy: userId,
    })
    await db.insert(fiscalPeriods).values({
      companyId, name: "August 2027", startDate: new Date("2027-08-01T00:00:00Z"),
      endDate: new Date("2027-08-31T23:59:59Z"), status: "open",
    })
  })

  afterAll(async () => {
    if (db) await cleanup(db)
    if (database) await database.close()
  })

  async function invoice(suffix: number, total = "100.0000") {
    const id = ids("f35", suffix)
    await db.insert(invoices).values({
      id, companyId, branchId, customerId, invoiceNumber: `INV-3C-${suffix}`,
      invoiceDate: new Date("2027-08-01T00:00:00Z"), dueDate: new Date("2027-08-31T00:00:00Z"),
      currency: "USD", status: "open", subtotal: total, total, balanceDue: total,
      postedAt: new Date("2027-08-01T00:00:00Z"), postedBy: userId,
      createdBy: userId, updatedBy: userId,
    })
    return id
  }

  async function payment(suffix: number, amount: string, invoiceId?: string, date = "2027-08-15") {
    const id = ids("f36", suffix)
    await db.insert(customerPayments).values({
      id, companyId, branchId, customerId, paymentNumber: `PAY-3C-${suffix}`,
      paymentDate: new Date(`${date}T00:00:00Z`), currency: "USD", amount,
      unappliedAmount: amount, paymentMethod: "bank-transfer", depositAccountId: bankId,
      status: "draft", createdBy: userId, updatedBy: userId,
    })
    if (invoiceId) await db.insert(customerPaymentAllocations).values({ paymentId: id, invoiceId, amount })
    return id
  }

  it("serializes concurrent retries of the same payment into one GL and settlement", async () => {
    const invoiceId = await invoice(1)
    const paymentId = await payment(1, "100.0000", invoiceId)
    const results = await Promise.all([
      repository.post(context, paymentId, "phase-3c-same-payment"),
      repository.post(context, paymentId, "phase-3c-same-payment"),
    ])
    expect(results.map((result) => result.status)).toEqual(["posted", "posted"])
    const [settled] = await db.select().from(invoices).where(eq(invoices.id, invoiceId))
    expect(settled).toMatchObject({ status: "paid", amountPaid: "100.0000", balanceDue: "0.0000" })
    const journals = await db.select().from(accountingTransactions).where(and(
      eq(accountingTransactions.companyId, companyId),
      eq(accountingTransactions.sourceType, "customer_payment"),
      eq(accountingTransactions.sourceId, paymentId),
    ))
    expect(journals).toHaveLength(1)
  }, 60_000)

  it("locks a shared invoice so concurrent payments cannot over-allocate it", async () => {
    const invoiceId = await invoice(2)
    const firstId = await payment(2, "80.0000", invoiceId)
    const secondId = await payment(3, "80.0000", invoiceId)
    const results = await Promise.allSettled([
      repository.post(context, firstId, "phase-3c-shared-first"),
      repository.post(context, secondId, "phase-3c-shared-second"),
    ])
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1)
    const [settled] = await db.select().from(invoices).where(eq(invoices.id, invoiceId))
    expect(settled).toMatchObject({ status: "partially_paid", amountPaid: "80.0000", balanceDue: "20.0000" })
    const [{ postedTotal }] = await db.select({
      postedTotal: sql<string>`coalesce(sum(${customerPaymentAllocations.amount}), 0)::text`,
    }).from(customerPaymentAllocations)
      .innerJoin(customerPayments, eq(customerPaymentAllocations.paymentId, customerPayments.id))
      .where(and(eq(customerPaymentAllocations.invoiceId, invoiceId), eq(customerPayments.status, "posted")))
    expect(postedTotal).toBe("80.0000")
  }, 60_000)

  it("rolls settlement and payment lifecycle back when GL posting fails", async () => {
    const invoiceId = await invoice(3)
    const paymentId = await payment(4, "25.0000", invoiceId, "2027-09-15")
    await expect(repository.post(context, paymentId, "phase-3c-gl-failure"))
      .rejects.toThrow("No fiscal period")
    const [[unchangedInvoice], [draftPayment], journals] = await Promise.all([
      db.select().from(invoices).where(eq(invoices.id, invoiceId)),
      db.select().from(customerPayments).where(eq(customerPayments.id, paymentId)),
      db.select().from(accountingTransactions).where(eq(accountingTransactions.sourceId, paymentId)),
    ])
    expect(unchangedInvoice).toMatchObject({ status: "open", amountPaid: "0.0000", balanceDue: "100.0000" })
    expect(draftPayment.status).toBe("draft")
    expect(journals).toHaveLength(0)
  }, 60_000)

  it("derives detail and list balances only from posted relational allocations", async () => {
    const invoiceId = await invoice(5)
    await db.update(invoices).set({ amountPaid: "99.0000", balanceDue: "1.0000", status: "partially_paid" })
      .where(eq(invoices.id, invoiceId))
    const draftPayment = await payment(5, "60.0000", invoiceId)

    const before = await invoiceRepository.findById(context, invoiceId)
    expect(before?.data).toMatchObject({ amountPaid: "0.0000", balanceDue: "100.0000" })

    await db.update(customerPayments).set({ status: "posted", unappliedAmount: "0.0000" })
      .where(eq(customerPayments.id, draftPayment))
    const secondPayment = await payment(6, "40.0000", invoiceId)
    await db.update(customerPayments).set({ status: "posted", unappliedAmount: "0.0000" })
      .where(eq(customerPayments.id, secondPayment))

    const detail = await invoiceRepository.findById(context, invoiceId)
    const listed = await invoiceRepository.list(context, { page: 1, pageSize: 20, order: "desc" })
    const listInvoice = listed.data.find((record) => record.id === invoiceId)
    expect(detail).toMatchObject({ status: "paid", data: { amountPaid: "100.0000", balanceDue: "0.0000" } })
    expect(listInvoice).toMatchObject({ status: "paid", data: { amountPaid: "100.0000", balanceDue: "0.0000" } })
  }, 60_000)
})
