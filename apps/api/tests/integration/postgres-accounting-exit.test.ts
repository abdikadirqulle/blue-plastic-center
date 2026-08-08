import "dotenv/config"
import { and, eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { createDatabase, type Database } from "../../src/db/client.js"
import {
  accountingLines,
  accountingTransactions,
  accounts,
  auditEvents,
  branches,
  companies,
  fiscalPeriods,
  postingIdempotencyKeys,
  resourceRecords,
  users,
} from "../../src/db/schema.js"
import { PostgresLedgerRepository } from "../../src/modules/accounting/postgres-ledger-repository.js"
import type { PostingCommand } from "../../src/modules/accounting/posting-engine.js"
import { systemAccountKeys } from "../../src/modules/accounting/system-accounts.js"
import type { RequestContext } from "../../src/platform/types.js"

const enabled = process.env.RUN_POSTGRES_INTEGRATION === "1" && Boolean(process.env.DATABASE_URL)
const postgresDescribe = enabled ? describe.sequential : describe.skip

const companyA = "f2000000-0000-4000-8000-000000000001"
const companyB = "f2000000-0000-4000-8000-000000000002"
const branchA = "f2100000-0000-4000-8000-000000000001"
const branchB = "f2100000-0000-4000-8000-000000000002"
const userA = "f2200000-0000-4000-8000-000000000001"
const userB = "f2200000-0000-4000-8000-000000000002"
const cashA = "f2300000-0000-4000-8000-000000000001"
const revenueA = "f2300000-0000-4000-8000-000000000002"
const inactiveA = "f2300000-0000-4000-8000-000000000003"
const cashB = "f2300000-0000-4000-8000-000000000004"

const contextA: RequestContext = {
  requestId: "phase-2g-postgres",
  companyId: companyA,
  branchId: branchA,
  principal: { userId: userA, name: "Phase 2G", role: "administrator" },
}

const sourceId = (suffix: number) =>
  `f2400000-0000-4000-8000-${String(suffix).padStart(12, "0")}`

const posting = (
  suffix: number,
  overrides: Partial<PostingCommand> = {},
): PostingCommand => ({
  sourceModule: "accounting",
  sourceType: "phase-2g-probe",
  sourceId: sourceId(suffix),
  postingKind: "primary",
  idempotencyKey: `phase-2g-${suffix}`,
  transactionDate: "2027-01-15",
  currency: "USD",
  lines: [
    { accountId: cashA, debit: "10.0000", credit: "0.0000" },
    { accountId: revenueA, debit: "0.0000", credit: "10.0000" },
  ],
  ...overrides,
})

async function cleanup(db: Database) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`delete from audit_events where company_id in (${companyA}, ${companyB})`)
    await tx.execute(sql`delete from accounting_lines where transaction_id in (
      select id from accounting_transactions where company_id in (${companyA}, ${companyB})
    )`)
    await tx.execute(sql`delete from posting_idempotency_keys where company_id in (${companyA}, ${companyB})`)
    await tx.execute(sql`delete from accounting_transactions
      where company_id in (${companyA}, ${companyB}) and reversal_of_id is not null`)
    await tx.execute(sql`delete from accounting_transactions where company_id in (${companyA}, ${companyB})`)
    await tx.execute(sql`delete from resource_records where company_id in (${companyA}, ${companyB})`)
    await tx.execute(sql`delete from fiscal_periods where company_id in (${companyA}, ${companyB})`)
    await tx.execute(sql`delete from accounts where company_id in (${companyA}, ${companyB})`)
    await tx.execute(sql`delete from users where company_id in (${companyA}, ${companyB})`)
    await tx.execute(sql`delete from branches where company_id in (${companyA}, ${companyB})`)
    await tx.execute(sql`delete from companies where id in (${companyA}, ${companyB})`)
  })
}

postgresDescribe("Accounting Core PostgreSQL exit gate", () => {
  let database: ReturnType<typeof createDatabase>
  let db: Database
  let ledger: PostgresLedgerRepository

  beforeAll(async () => {
    database = createDatabase(process.env.DATABASE_URL!)
    db = database.db
    ledger = new PostgresLedgerRepository(db)
    await cleanup(db)
    await db.insert(companies).values([
      { id: companyA, legalName: "Phase 2G Company A", functionalCurrency: "USD" },
      { id: companyB, legalName: "Phase 2G Company B", functionalCurrency: "USD" },
    ])
    await db.insert(branches).values([
      { id: branchA, companyId: companyA, name: "Main", code: "MAIN" },
      { id: branchB, companyId: companyB, name: "Main", code: "MAIN" },
    ])
    await db.insert(users).values([
      { id: userA, companyId: companyA, username: "phase2g-a", email: "phase2g-a@test.invalid", displayName: "Phase 2G A", role: "administrator" },
      { id: userB, companyId: companyB, username: "phase2g-b", email: "phase2g-b@test.invalid", displayName: "Phase 2G B", role: "administrator" },
    ])
    await db.insert(accounts).values([
      { id: cashA, companyId: companyA, accountNumber: "1000", name: "Cash", type: "asset", systemKey: systemAccountKeys.CASH, normalBalance: "debit" },
      { id: revenueA, companyId: companyA, accountNumber: "4000", name: "Sales", type: "income", systemKey: systemAccountKeys.SALES_REVENUE, normalBalance: "credit" },
      { id: inactiveA, companyId: companyA, accountNumber: "1999", name: "Inactive", type: "asset", active: false },
      { id: cashB, companyId: companyB, accountNumber: "1000", name: "Other cash", type: "asset", systemKey: systemAccountKeys.CASH, normalBalance: "debit" },
    ])
    await db.insert(fiscalPeriods).values([
      { companyId: companyA, name: "January 2027", startDate: new Date("2027-01-01T00:00:00Z"), endDate: new Date("2027-01-31T23:59:59Z"), status: "open" },
      { companyId: companyA, name: "March 2027", startDate: new Date("2027-03-01T00:00:00Z"), endDate: new Date("2027-03-31T23:59:59Z"), status: "closed" },
      { companyId: companyA, name: "April 2027", startDate: new Date("2027-04-01T00:00:00Z"), endDate: new Date("2027-04-30T23:59:59Z"), status: "open" },
      { companyId: companyA, name: "Overlapping April 2027", startDate: new Date("2027-04-15T00:00:00Z"), endDate: new Date("2027-05-15T23:59:59Z"), status: "open" },
      { companyId: companyB, name: "June 2027", startDate: new Date("2027-06-01T00:00:00Z"), endDate: new Date("2027-06-30T23:59:59Z"), status: "open" },
    ])
  })

  afterAll(async () => {
    if (db) await cleanup(db)
    if (database) await database.close()
  })

  it("commits exact transaction and functional journal facts", async () => {
    const result = await ledger.post(contextA, posting(1))
    const [transaction] = await db.select().from(accountingTransactions)
      .where(eq(accountingTransactions.id, result.transactionId))
    const lines = await db.select().from(accountingLines)
      .where(eq(accountingLines.transactionId, result.transactionId))
      .orderBy(accountingLines.lineNumber)
    expect(transaction.functionalCurrency).toBe("USD")
    expect(lines).toHaveLength(2)
    expect(lines.map((line) => [
      line.debit,
      line.credit,
      line.functionalDebit,
      line.functionalCredit,
    ])).toEqual([
      ["10.0000", "0.0000", "10.0000", "0.0000"],
      ["0.0000", "10.0000", "0.0000", "10.0000"],
    ])
  })

  it("rejects zero/unbalanced journals without partial facts", async () => {
    for (const command of [
      posting(2, { lines: [
        { accountId: cashA, debit: "0.0000", credit: "0.0000" },
        { accountId: revenueA, debit: "0.0000", credit: "0.0000" },
      ] }),
      posting(3, { lines: [
        { accountId: cashA, debit: "10.0000", credit: "0.0000" },
        { accountId: revenueA, debit: "0.0000", credit: "9.0000" },
      ] }),
    ]) await expect(ledger.post(contextA, command)).rejects.toThrow()
    const facts = await db.select({ id: accountingTransactions.id }).from(accountingTransactions)
      .where(and(eq(accountingTransactions.companyId, companyA), eq(accountingTransactions.sourceType, "phase-2g-probe")))
    expect(facts.map((row) => row.id)).toHaveLength(1)
  })

  it("enforces fiscal period exact-one OPEN company scope", async () => {
    await expect(ledger.post(contextA, posting(4, { transactionDate: "2027-02-15" })))
      .rejects.toThrow("No fiscal period")
    await expect(ledger.post(contextA, posting(5, { transactionDate: "2027-03-15" })))
      .rejects.toThrow("is not open")
    await expect(ledger.post(contextA, posting(6, { transactionDate: "2027-04-20" })))
      .rejects.toThrow("Multiple fiscal periods")
    await expect(ledger.post(contextA, posting(7, { transactionDate: "2027-06-15" })))
      .rejects.toThrow("No fiscal period")
  })

  it("enforces semantic, inactive, explicit and cross-company account rules", async () => {
    await expect(ledger.resolveAccountMeaning(companyA, systemAccountKeys.CASH))
      .resolves.toMatchObject({ id: cashA })
    await expect(ledger.post(contextA, posting(8, { lines: [
      { systemAccountKey: systemAccountKeys.CASH, debit: "3.0000", credit: "0.0000" },
      { accountId: revenueA, debit: "0.0000", credit: "3.0000" },
    ] }))).resolves.toMatchObject({ status: "posted" })
    await expect(ledger.post(contextA, posting(9, { lines: [
      { accountId: inactiveA, debit: "3.0000", credit: "0.0000" },
      { accountId: revenueA, debit: "0.0000", credit: "3.0000" },
    ] }))).rejects.toThrow("inactive")
    await expect(ledger.post(contextA, posting(10, { lines: [
      { accountId: cashB, debit: "3.0000", credit: "0.0000" },
      { accountId: revenueA, debit: "0.0000", credit: "3.0000" },
    ] }))).rejects.toThrow("not found in this company")
    await expect(ledger.post(contextA, posting(17, { currency: "EUR" })))
      .rejects.toThrow("Foreign-currency GL conversion is not enabled")
  })

  it("keeps PostgreSQL idempotency stable and conflicting payloads distinct", async () => {
    const command = posting(11)
    const first = await ledger.post(contextA, command)
    await expect(ledger.post(contextA, command)).resolves.toEqual(first)
    await expect(ledger.post(contextA, { ...command, memo: "changed" }))
      .rejects.toThrow("different request")
    const facts = await db.select({ id: accountingTransactions.id }).from(accountingTransactions)
      .where(and(eq(accountingTransactions.companyId, companyA), eq(accountingTransactions.sourceId, command.sourceId)))
    expect(facts).toHaveLength(1)
  })

  it("creates one exact immutable reversal and safely retries it", async () => {
    const command = posting(12)
    const primary = await ledger.post(contextA, command)
    const originalLines = await db.select().from(accountingLines)
      .where(eq(accountingLines.transactionId, primary.transactionId))
      .orderBy(accountingLines.lineNumber)
    const reversalInput = {
      sourceModule: command.sourceModule,
      sourceType: command.sourceType,
      sourceId: command.sourceId,
      reversalDate: "2027-01-20",
      idempotencyKey: "phase-2g-reversal-12",
      memo: "Exit-gate reversal",
    }
    const reversal = await ledger.reverseTransaction(contextA, reversalInput)
    await expect(ledger.reverseTransaction(contextA, reversalInput)).resolves.toEqual(reversal)
    await expect(ledger.reverseTransaction(contextA, {
      ...reversalInput,
      idempotencyKey: "phase-2g-reversal-12-distinct",
    })).rejects.toThrow()
    const reversalLines = await db.select().from(accountingLines)
      .where(eq(accountingLines.transactionId, reversal.transactionId))
      .orderBy(accountingLines.lineNumber)
    const unchanged = await db.select().from(accountingLines)
      .where(eq(accountingLines.transactionId, primary.transactionId))
      .orderBy(accountingLines.lineNumber)
    expect(unchanged).toEqual(originalLines)
    expect(reversalLines.map((line) => [line.debit, line.credit, line.functionalDebit, line.functionalCredit]))
      .toEqual(originalLines.map((line) => [line.credit, line.debit, line.functionalCredit, line.functionalDebit]))
  })

  it("composes caller-owned commit, rollback, GL failure and retry", async () => {
    const committed = posting(13)
    await db.transaction(async (tx) => {
      await tx.insert(resourceRecords).values({
        id: committed.sourceId, module: "accounting", resource: "phase-2g-probe",
        companyId: companyA, branchId: branchA, status: "posted", data: {},
        createdBy: userA, updatedBy: userA,
      })
      await ledger.postInTransaction(tx, contextA, committed)
    })
    expect(await db.select().from(resourceRecords).where(eq(resourceRecords.id, committed.sourceId)))
      .toHaveLength(1)

    const rolledBack = posting(14)
    await expect(db.transaction(async (tx) => {
      await tx.insert(resourceRecords).values({
        id: rolledBack.sourceId, module: "accounting", resource: "phase-2g-probe",
        companyId: companyA, branchId: branchA, status: "posted", data: {},
        createdBy: userA, updatedBy: userA,
      })
      await ledger.postInTransaction(tx, contextA, rolledBack)
      throw new Error("caller rollback")
    })).rejects.toThrow("caller rollback")
    expect(await db.select().from(resourceRecords).where(eq(resourceRecords.id, rolledBack.sourceId)))
      .toHaveLength(0)
    expect(await db.select().from(accountingTransactions)
      .where(eq(accountingTransactions.sourceId, rolledBack.sourceId))).toHaveLength(0)
    expect(await db.select().from(postingIdempotencyKeys)
      .where(and(
        eq(postingIdempotencyKeys.companyId, companyA),
        eq(postingIdempotencyKeys.key, rolledBack.idempotencyKey),
      ))).toHaveLength(0)
    expect(await db.select().from(auditEvents)
      .where(and(eq(auditEvents.companyId, companyA), eq(auditEvents.entityId, rolledBack.sourceId))))
      .toHaveLength(0)

    await db.transaction(async (tx) => {
      await tx.insert(resourceRecords).values({
        id: rolledBack.sourceId, module: "accounting", resource: "phase-2g-probe",
        companyId: companyA, branchId: branchA, status: "posted", data: { retry: true },
        createdBy: userA, updatedBy: userA,
      })
      await ledger.postInTransaction(tx, contextA, rolledBack)
    })
    expect(await db.select().from(accountingTransactions)
      .where(eq(accountingTransactions.sourceId, rolledBack.sourceId))).toHaveLength(1)

    const glFailure = posting(16, { lines: [
      { accountId: cashA, debit: "5.0000", credit: "0.0000" },
      { accountId: revenueA, debit: "0.0000", credit: "4.0000" },
    ] })
    await expect(db.transaction(async (tx) => {
      await tx.insert(resourceRecords).values({
        id: glFailure.sourceId, module: "accounting", resource: "phase-2g-probe",
        companyId: companyA, branchId: branchA, status: "draft", data: {},
        createdBy: userA, updatedBy: userA,
      })
      await ledger.postInTransaction(tx, contextA, glFailure)
    })).rejects.toThrow("equal non-zero debits and credits")
    expect(await db.select().from(resourceRecords).where(eq(resourceRecords.id, glFailure.sourceId)))
      .toHaveLength(0)
  })

  it("allows only one concurrent posting and one concurrent reversal effect", async () => {
    const concurrent = posting(15)
    const originalLines = concurrent.lines.map((line) => ({
      debit: line.debit,
      credit: line.credit,
    }))
    const postingResults = await Promise.allSettled([
      ledger.post(contextA, concurrent),
      ledger.post(contextA, concurrent),
    ])
    const successfulPostings = postingResults.filter(
      (result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof ledger.post>>> =>
        result.status === "fulfilled",
    )
    expect(successfulPostings).toHaveLength(2)
    expect(new Set(successfulPostings.map((result) => result.value.transactionId)).size).toBe(1)
    const postedFacts = await db.select({ id: accountingTransactions.id }).from(accountingTransactions)
      .where(and(eq(accountingTransactions.companyId, companyA), eq(accountingTransactions.sourceId, concurrent.sourceId)))
    expect(postedFacts).toHaveLength(1)
    expect(await db.select().from(accountingLines)
      .where(eq(accountingLines.transactionId, postedFacts[0].id))).toHaveLength(2)

    const reversalInput = (key: string) => ({
      sourceModule: concurrent.sourceModule,
      sourceType: concurrent.sourceType,
      sourceId: concurrent.sourceId,
      reversalDate: "2027-01-21",
      idempotencyKey: key,
    })
    const reversalResults = await Promise.allSettled([
      ledger.reverseTransaction(contextA, reversalInput("phase-2g-race-reversal-a")),
      ledger.reverseTransaction(contextA, reversalInput("phase-2g-race-reversal-b")),
    ])
    expect(reversalResults.filter((result) => result.status === "fulfilled")).toHaveLength(1)
    expect(reversalResults.filter((result) => result.status === "rejected")).toHaveLength(1)
    const reversals = await db.select({ id: accountingTransactions.id }).from(accountingTransactions)
      .where(eq(accountingTransactions.reversalOfId, postedFacts[0].id))
    expect(reversals).toHaveLength(1)
    expect(await db.select({ debit: accountingLines.debit, credit: accountingLines.credit })
      .from(accountingLines)
      .where(eq(accountingLines.transactionId, postedFacts[0].id))
      .orderBy(accountingLines.lineNumber)).toEqual(originalLines)
    expect(await db.select().from(accountingLines)
      .where(eq(accountingLines.transactionId, reversals[0].id))).toHaveLength(2)
  })
})
