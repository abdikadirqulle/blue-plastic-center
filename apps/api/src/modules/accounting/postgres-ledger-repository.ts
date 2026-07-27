import { randomUUID } from "node:crypto"
import { and, eq, gte, lte, or, sql } from "drizzle-orm"
import type { Database } from "../../db/client.js"
import {
  accountingLines,
  accountingTransactions,
  accounts,
  auditEvents,
  fiscalPeriods,
  resourceRecords,
} from "../../db/schema.js"
import { conflict, notFound } from "../../platform/errors.js"
import type { RequestContext, ResourceRecord } from "../../platform/types.js"
import { assertBalanced } from "./ledger-math.js"
import type { LedgerRepository } from "./ledger-repository.js"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export class PostgresLedgerRepository implements LedgerRepository {
  constructor(private readonly db: Database) {}

  async postJournal(context: RequestContext, journal: ResourceRecord) {
    const date = new Date(String(journal.data.journalDate))
    const lines = journal.data.lines as Array<Record<string, unknown>>
    assertBalanced(lines)
    return this.db.transaction(async (transaction) => {
      const [closed] = await transaction
        .select({ id: fiscalPeriods.id })
        .from(fiscalPeriods)
        .where(
          and(
            eq(fiscalPeriods.companyId, context.companyId),
            eq(fiscalPeriods.status, "closed"),
            lte(fiscalPeriods.startDate, date),
            gte(fiscalPeriods.endDate, date),
          ),
        )
        .limit(1)
      if (closed) throw conflict("The fiscal period is closed")

      const [period] = await transaction
        .select({ id: fiscalPeriods.id })
        .from(fiscalPeriods)
        .where(
          and(
            eq(fiscalPeriods.companyId, context.companyId),
            lte(fiscalPeriods.startDate, date),
            gte(fiscalPeriods.endDate, date),
          ),
        )
        .limit(1)

      const resolvedLines: Array<
        Record<string, unknown> & { accountId: string }
      > = []
      for (const line of lines) {
        const key = String(line.accountId)
        const conditions = [eq(accounts.accountNumber, key)]
        if (uuidPattern.test(key)) conditions.push(eq(accounts.id, key))
        const [account] = await transaction
          .select()
          .from(accounts)
          .where(
            and(eq(accounts.companyId, context.companyId), or(...conditions)),
          )
          .limit(1)
        if (!account) throw notFound(`Ledger account ${key} was not found`)
        resolvedLines.push({ ...line, accountId: account.id })
      }

      const transactionId = randomUUID()
      await transaction.insert(accountingTransactions).values({
        id: transactionId,
        companyId: context.companyId,
        branchId: context.branchId,
        transactionNumber: `JOU-${journal.id.slice(0, 8).toUpperCase()}`,
        transactionDate: date,
        sourceModule: String(journal.data.sourceModule ?? "accounting"),
        sourceId: journal.id,
        fiscalPeriodId: period?.id,
        reversalOfId: journal.data.reversalOfId
          ? String(journal.data.reversalOfId)
          : undefined,
        status: "posted",
        currency: String(journal.data.currency ?? "USD"),
        exchangeRate: String(journal.data.exchangeRate ?? "1"),
        memo: journal.data.memo ? String(journal.data.memo) : undefined,
        postedAt: new Date(),
        postedBy: context.principal.userId,
      })
      await transaction.insert(accountingLines).values(
        resolvedLines.map((line, index) => ({
          transactionId,
          accountId: String(line.accountId),
          description: line.description ? String(line.description) : undefined,
          debit: String(line.debit ?? "0"),
          credit: String(line.credit ?? "0"),
          lineNumber: index + 1,
        })),
      )
      const [updated] = await transaction
        .update(resourceRecords)
        .set({
          status: "posted",
          version: journal.version + 1,
          updatedAt: new Date(),
          updatedBy: context.principal.userId,
        })
        .where(
          and(
            eq(resourceRecords.id, journal.id),
            eq(resourceRecords.version, journal.version),
          ),
        )
        .returning()
      if (!updated) throw conflict("Journal changed before it could be posted")
      await transaction.insert(auditEvents).values({
        id: randomUUID(),
        requestId: context.requestId,
        companyId: context.companyId,
        branchId: context.branchId,
        userId: context.principal.userId,
        action: "post",
        entityType: "accounting/journal-entries",
        entityId: journal.id,
      })
      return {
        ...journal,
        status: "posted",
        version: journal.version + 1,
        updatedAt: updated.updatedAt.toISOString(),
        updatedBy: context.principal.userId,
      }
    })
  }

  async reverseJournal(
    context: RequestContext,
    journal: ResourceRecord,
    reversalDate: string,
    memo?: string,
  ) {
    const [source] = await this.db
      .select()
      .from(accountingTransactions)
      .where(
        and(
          eq(accountingTransactions.sourceId, journal.id),
          eq(accountingTransactions.status, "posted"),
        ),
      )
      .limit(1)
    if (!source) throw notFound("Posted ledger transaction was not found")
    const sourceLines = await this.db
      .select()
      .from(accountingLines)
      .where(eq(accountingLines.transactionId, source.id))
    const now = new Date().toISOString()
    const reversal: ResourceRecord = {
      ...journal,
      id: randomUUID(),
      status: "draft",
      version: 1,
      data: {
        journalDate: reversalDate,
        memo: memo ?? `Reversal of ${journal.id}`,
        reversalOfId: source.id,
        lines: sourceLines.map((line) => ({
          accountId: line.accountId,
          description: line.description,
          debit: line.credit,
          credit: line.debit,
        })),
      },
      createdAt: now,
      updatedAt: now,
      createdBy: context.principal.userId,
      updatedBy: context.principal.userId,
    }
    await this.db.insert(resourceRecords).values({
      id: reversal.id,
      companyId: reversal.companyId,
      branchId: reversal.branchId,
      module: reversal.module,
      resource: reversal.resource,
      status: reversal.status,
      data: reversal.data,
      version: reversal.version,
      createdBy: reversal.createdBy,
      updatedBy: reversal.updatedBy,
      isDeleted: false,
      deletedAt: null,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    })
    return this.postJournal(context, reversal)
  }

  async closePeriod(
    context: RequestContext,
    input: { name: string; startDate: string; endDate: string },
  ) {
    await this.db
      .insert(fiscalPeriods)
      .values({
        companyId: context.companyId,
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        status: "closed",
        closedAt: new Date(),
        closedBy: context.principal.userId,
      })
      .onConflictDoUpdate({
        target: [fiscalPeriods.companyId, fiscalPeriods.name],
        set: {
          status: "closed",
          closedAt: new Date(),
          closedBy: context.principal.userId,
        },
      })
  }

  async reopenPeriod(context: RequestContext, name: string) {
    await this.db
      .update(fiscalPeriods)
      .set({
        status: "open",
        closedAt: null,
        closedBy: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(fiscalPeriods.companyId, context.companyId),
          eq(fiscalPeriods.name, name),
        ),
      )
  }

  async trialBalance(companyId: string, from: string, to: string) {
    const rows = await this.db
      .select({
        accountId: accounts.id,
        accountNumber: accounts.accountNumber,
        accountName: accounts.name,
        accountType: accounts.type,
        debit: sql<string>`coalesce(sum(${accountingLines.debit}), 0)::text`,
        credit: sql<string>`coalesce(sum(${accountingLines.credit}), 0)::text`,
        balance: sql<string>`(coalesce(sum(${accountingLines.debit}), 0) - coalesce(sum(${accountingLines.credit}), 0))::text`,
      })
      .from(accountingLines)
      .innerJoin(
        accountingTransactions,
        eq(accountingLines.transactionId, accountingTransactions.id),
      )
      .innerJoin(accounts, eq(accountingLines.accountId, accounts.id))
      .where(
        and(
          eq(accountingTransactions.companyId, companyId),
          eq(accountingTransactions.status, "posted"),
          gte(accountingTransactions.transactionDate, new Date(from)),
          lte(accountingTransactions.transactionDate, new Date(to)),
        ),
      )
      .groupBy(
        accounts.id,
        accounts.accountNumber,
        accounts.name,
        accounts.type,
      )
    return rows
  }
}
