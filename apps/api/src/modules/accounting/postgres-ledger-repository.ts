import { randomUUID } from "node:crypto"
import { and, eq, gte, lte, or, sql } from "drizzle-orm"
import type { Database, DatabaseTransaction } from "../../db/client.js"
import {
  accountingLines,
  accountingTransactions,
  accounts,
  auditEvents,
  fiscalPeriods,
  postingIdempotencyKeys,
  resourceRecords,
} from "../../db/schema.js"
import { conflict, notFound } from "../../platform/errors.js"
import type { RequestContext, ResourceRecord } from "../../platform/types.js"
import type { LedgerRepository, SourceReversalInput } from "./ledger-repository.js"
import {
  createReversalCommand,
  postingFingerprint,
  postingRequestHash,
  validatePostingCommand,
  type PostingCommand,
  type PostingResult,
} from "./posting-engine.js"

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * A reversal cancels an entry by adding its opposite, so both sides stay in the
 * books and net to zero. Reading only `posted` rows would drop the original and
 * leave the reversal standing alone, which shifts every balance after a void.
 */
const inTheBooks = or(
  eq(accountingTransactions.status, "posted"),
  eq(accountingTransactions.status, "reversed"),
)

export class PostgresLedgerRepository implements LedgerRepository {
  constructor(private readonly db: Database) {}

  async post(context: RequestContext, command: PostingCommand) {
    return this.db.transaction((transaction) =>
      this.postInTransaction(transaction, context, command),
    )
  }

  /**
   * Transaction-scoped posting port for financial application services. Source
   * writes, inventory movements, the journal and audit must share this exact
   * Drizzle transaction so any failure rolls back the whole business action.
   */
  async postInTransaction(
    transaction: DatabaseTransaction,
    context: RequestContext,
    command: PostingCommand,
    manual = false,
  ) {
    validatePostingCommand(command)
    const requestHash = postingRequestHash(command)
    const fingerprint = postingFingerprint(context.companyId, command)
    const postingKind = command.postingKind ?? "primary"
    const [claim] = await transaction
      .insert(postingIdempotencyKeys)
      .values({
        companyId: context.companyId,
        key: command.idempotencyKey,
        requestHash,
        sourceModule: command.sourceModule,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        postingKind,
        status: "processing",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        createdBy: context.principal.userId,
        updatedBy: context.principal.userId,
      })
      .onConflictDoNothing()
      .returning({ id: postingIdempotencyKeys.id })

    if (!claim) {
      const [known] = await transaction
        .select()
        .from(postingIdempotencyKeys)
        .where(
          and(
            eq(postingIdempotencyKeys.companyId, context.companyId),
            eq(postingIdempotencyKeys.key, command.idempotencyKey),
          ),
        )
        .limit(1)
      if (known) {
        if (known.requestHash !== requestHash)
          throw conflict("Posting idempotency key was reused with a different request")
        if (known.status === "completed" && known.response)
          return known.response as unknown as PostingResult
        throw conflict("Posting request is already being processed")
      }

      const [knownSource] = await transaction
        .select({ key: postingIdempotencyKeys.key })
        .from(postingIdempotencyKeys)
        .where(
          and(
            eq(postingIdempotencyKeys.companyId, context.companyId),
            eq(postingIdempotencyKeys.sourceModule, command.sourceModule),
            eq(postingIdempotencyKeys.sourceType, command.sourceType),
            eq(postingIdempotencyKeys.sourceId, command.sourceId),
            eq(postingIdempotencyKeys.postingKind, postingKind),
          ),
        )
        .limit(1)
      if (knownSource) throw conflict("Source transaction posting already exists")
      throw conflict("Posting request could not acquire its idempotency key")
    }

    const result = await this.writePosting(
      transaction,
      context,
      command,
      fingerprint,
      manual,
    )
    await transaction
      .update(postingIdempotencyKeys)
      .set({
        status: "completed",
        transactionId: result.transactionId,
        response: { ...result },
        updatedAt: new Date(),
        updatedBy: context.principal.userId,
      })
      .where(eq(postingIdempotencyKeys.id, claim.id))
    return result
  }

  async reverseTransaction(context: RequestContext, input: SourceReversalInput) {
    return this.db.transaction((transaction) =>
      this.reverseTransactionInTransaction(transaction, context, input),
    )
  }

  /**
   * Reverses the primary posting of a source document. The reversal and the
   * status change of the original share the caller's transaction so a business
   * action such as voiding an invoice can never half-apply.
   */
  async reverseTransactionInTransaction(
    transaction: DatabaseTransaction,
    context: RequestContext,
    input: SourceReversalInput,
  ) {
    const [original] = await transaction
      .select()
      .from(accountingTransactions)
      .where(
        and(
          eq(accountingTransactions.companyId, context.companyId),
          eq(accountingTransactions.sourceModule, input.sourceModule),
          eq(accountingTransactions.sourceType, input.sourceType),
          eq(accountingTransactions.sourceId, input.sourceId),
          eq(accountingTransactions.postingKind, "primary"),
          eq(accountingTransactions.status, "posted"),
        ),
      )
      .limit(1)
    if (!original) throw notFound("A posted transaction for this document was not found")

    const lines = await transaction
      .select()
      .from(accountingLines)
      .where(eq(accountingLines.transactionId, original.id))
    const result = await this.postInTransaction(
      transaction,
      context,
      createReversalCommand({
        original: {
          transactionId: original.id,
          sourceModule: original.sourceModule,
          sourceType: original.sourceType,
          sourceId: input.sourceId,
          currency: original.currency,
          exchangeRate: original.exchangeRate,
          lines,
        },
        reversalDate: input.reversalDate,
        idempotencyKey: input.idempotencyKey,
        memo: input.memo ?? `Reversal of ${original.transactionNumber}`,
      }),
    )
    const reversedAt = new Date()
    const [marked] = await transaction
      .update(accountingTransactions)
      .set({
        status: "reversed",
        reversedAt,
        reversedBy: context.principal.userId,
        updatedAt: reversedAt,
      })
      .where(
        and(
          eq(accountingTransactions.id, original.id),
          eq(accountingTransactions.companyId, context.companyId),
          eq(accountingTransactions.status, "posted"),
        ),
      )
      .returning({ id: accountingTransactions.id })
    if (!marked) throw conflict("The transaction was already reversed by another request")
    return result
  }

  async postJournal(context: RequestContext, journal: ResourceRecord) {
    if (journal.status !== "draft") throw conflict("Only draft journal entries can be posted")
    if (journal.data.reversalOfId) throw conflict("Use the secured reversal endpoint")
    return this.db.transaction((transaction) =>
      this.postJournalInTransaction(transaction, context, journal),
    )
  }

  private async postJournalInTransaction(
    transaction: DatabaseTransaction,
    context: RequestContext,
    journal: ResourceRecord,
    manual = true,
  ) {
    const lines = journal.data.lines as Array<Record<string, unknown>>
    const sourceId = manual ? journal.id : String(journal.data.sourceId)
    const sourceModule = "accounting"
    const sourceType = "journal"
    const postingKind: PostingCommand["postingKind"] = !manual && journal.data.reversalOfId
      ? "reversal"
      : "primary"
    const command: PostingCommand = {
      sourceModule,
      sourceType,
      sourceId,
      postingKind,
      idempotencyKey: String(journal.data.idempotencyKey ?? `journal:${journal.id}`),
      transactionDate: String(journal.data.journalDate),
      currency: String(journal.data.currency ?? "USD"),
      exchangeRate: String(journal.data.exchangeRate ?? "1"),
      memo: journal.data.memo ? String(journal.data.memo) : undefined,
      lines: lines.map((line) => {
        const accountReference = String(line.accountId)
        return {
          ...(uuidPattern.test(accountReference)
            ? { accountId: accountReference }
            : { accountNumber: accountReference }),
          description: line.description ? String(line.description) : undefined,
          debit: String(line.debit ?? "0"),
          credit: String(line.credit ?? "0"),
        }
      }),
      reversalOfId: journal.data.reversalOfId
        ? String(journal.data.reversalOfId)
        : undefined,
    }
    await this.postInTransaction(transaction, context, command, manual)

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
          eq(resourceRecords.companyId, context.companyId),
          eq(resourceRecords.module, "accounting"),
          eq(resourceRecords.resource, "journal-entries"),
          eq(resourceRecords.isDeleted, false),
          eq(resourceRecords.version, journal.version),
        ),
      )
      .returning()
    if (!updated) throw conflict("Journal changed before it could be posted")
    return {
      ...journal,
      status: "posted",
      version: journal.version + 1,
      updatedAt: updated.updatedAt.toISOString(),
      updatedBy: context.principal.userId,
    }
  }

  private async writePosting(
    transaction: DatabaseTransaction,
    context: RequestContext,
    command: PostingCommand,
    fingerprint: string,
    manual: boolean,
  ): Promise<PostingResult> {
    const date = new Date(command.transactionDate)
    const postingKind = command.postingKind ?? "primary"
    if (postingKind === "reversal") {
      const [original] = await transaction.select({
        id: accountingTransactions.id,
        sourceModule: accountingTransactions.sourceModule,
        sourceType: accountingTransactions.sourceType,
        sourceId: accountingTransactions.sourceId,
      }).from(accountingTransactions).where(and(
        eq(accountingTransactions.id, String(command.reversalOfId)),
        eq(accountingTransactions.companyId, context.companyId),
        eq(accountingTransactions.status, "posted"),
      )).limit(1)
      if (!original) throw notFound("Original posted transaction was not found in this company")
      if (
        original.sourceModule !== command.sourceModule ||
        original.sourceType !== command.sourceType ||
        original.sourceId !== command.sourceId
      ) throw conflict("Reversal source must match the original transaction")
    } else if (command.reversalOfId) {
      throw conflict("Only reversal postings may reference an original transaction")
    }
    const [closed] = await transaction.select({ id: fiscalPeriods.id }).from(fiscalPeriods)
      .where(and(
        eq(fiscalPeriods.companyId, context.companyId),
        eq(fiscalPeriods.status, "closed"),
        lte(fiscalPeriods.startDate, date),
        gte(fiscalPeriods.endDate, date),
      )).limit(1)
    if (closed) throw conflict("The fiscal period is closed")
    const [period] = await transaction.select({ id: fiscalPeriods.id }).from(fiscalPeriods)
      .where(and(
        eq(fiscalPeriods.companyId, context.companyId),
        lte(fiscalPeriods.startDate, date),
        gte(fiscalPeriods.endDate, date),
      )).limit(1)

    const [duplicate] = await transaction.select({ id: accountingTransactions.id })
      .from(accountingTransactions).where(and(
        eq(accountingTransactions.companyId, context.companyId),
        eq(accountingTransactions.sourceModule, command.sourceModule),
        eq(accountingTransactions.sourceType, command.sourceType),
        eq(accountingTransactions.sourceId, command.sourceId),
        eq(accountingTransactions.postingKind, command.postingKind ?? "primary"),
        or(
          eq(accountingTransactions.status, "posted"),
          eq(accountingTransactions.status, "reversed"),
        ),
      )).limit(1)
    if (duplicate) throw conflict("Source transaction posting already exists")

    const resolvedLines: Array<{ accountId: string; description?: string; debit: string; credit: string }> = []
    for (const line of command.lines) {
      const conditions = []
      if (line.accountId) conditions.push(eq(accounts.id, line.accountId))
      if (line.accountNumber) conditions.push(eq(accounts.accountNumber, line.accountNumber))
      if (line.systemAccountKey) conditions.push(eq(accounts.systemKey, line.systemAccountKey))
      const [account] = await transaction.select().from(accounts).where(and(
        eq(accounts.companyId, context.companyId),
        eq(accounts.active, true),
        or(...conditions),
      )).limit(1)
      const reference = line.accountId ?? line.accountNumber ?? line.systemAccountKey
      if (!account) throw notFound(`Active ledger account ${reference} was not found`)
      if (manual && (account.isControlAccount || !account.allowManualPosting))
        throw conflict(`Ledger account ${reference} does not allow manual posting`)
      resolvedLines.push({
        accountId: account.id,
        description: line.description,
        debit: line.debit,
        credit: line.credit,
      })
    }

    const transactionId = randomUUID()
    const transactionNumber = `JOU-${transactionId.slice(0, 8).toUpperCase()}`
    const [insertedTransaction] = await transaction.insert(accountingTransactions).values({
      id: transactionId,
      companyId: context.companyId,
      branchId: context.branchId,
      transactionNumber,
      transactionDate: date,
      sourceModule: command.sourceModule,
      sourceType: command.sourceType,
      sourceId: command.sourceId,
      postingKind: command.postingKind ?? "primary",
      postingFingerprint: fingerprint,
      idempotencyKey: command.idempotencyKey,
      fiscalPeriodId: period?.id,
      reversalOfId: command.reversalOfId,
      status: "posted",
      currency: command.currency,
      exchangeRate: command.exchangeRate ?? "1",
      memo: command.memo,
      postedAt: new Date(),
      postedBy: context.principal.userId,
    }).onConflictDoNothing().returning({ id: accountingTransactions.id })
    if (!insertedTransaction) throw conflict("Source transaction posting already exists")
    await transaction.insert(accountingLines).values(resolvedLines.map((line, index) => ({
      transactionId,
      accountId: line.accountId,
      description: line.description,
      debit: line.debit,
      credit: line.credit,
      lineNumber: index + 1,
    })))
    await transaction.insert(auditEvents).values({
      id: randomUUID(), requestId: context.requestId, companyId: context.companyId,
      branchId: context.branchId, userId: context.principal.userId, action: "post",
      entityType: `${command.sourceModule}/${command.sourceType}`, entityId: command.sourceId,
    })
    return {
      transactionId, transactionNumber, status: "posted", sourceModule: command.sourceModule,
      sourceType: command.sourceType, sourceId: command.sourceId,
      postingKind: command.postingKind ?? "primary", postingFingerprint: fingerprint,
    }
  }

  async reverseJournal(
    context: RequestContext,
    journal: ResourceRecord,
    reversalDate: string,
    memo?: string,
  ) {
    if (journal.status !== "posted") throw conflict("Only posted journals can be reversed")
    return this.db.transaction(async (transaction) => {
      const sourceId = journal.id
      const sourceModule = "accounting"
      const [source] = await transaction
        .select()
        .from(accountingTransactions)
        .where(
          and(
            eq(accountingTransactions.companyId, context.companyId),
            eq(accountingTransactions.sourceModule, sourceModule),
            eq(accountingTransactions.sourceId, sourceId),
            eq(accountingTransactions.status, "posted"),
          ),
        )
        .limit(1)
      if (!source) throw notFound("Posted ledger transaction was not found")

      const [existingReversal] = await transaction
        .select({ id: accountingTransactions.id })
        .from(accountingTransactions)
        .where(
          and(
            eq(accountingTransactions.companyId, context.companyId),
            eq(accountingTransactions.reversalOfId, source.id),
            eq(accountingTransactions.status, "posted"),
          ),
        )
        .limit(1)
      if (existingReversal) throw conflict("Journal entry is already reversed")

      const sourceLines = await transaction
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
          idempotencyKey: `reversal:${source.id}`,
          currency: source.currency,
          exchangeRate: source.exchangeRate,
          reversalOfId: source.id,
          sourceModule: source.sourceModule,
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          postingKind: "reversal",
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
      await transaction.insert(resourceRecords).values({
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
      const postedReversal = await this.postJournalInTransaction(transaction, context, reversal, false)
      const reversedAt = new Date()
      const [markedReversed] = await transaction.update(accountingTransactions).set({
        status: "reversed",
        reversedAt,
        reversedBy: context.principal.userId,
        updatedAt: reversedAt,
      }).where(and(
        eq(accountingTransactions.id, source.id),
        eq(accountingTransactions.companyId, context.companyId),
        eq(accountingTransactions.status, "posted"),
      )).returning({ id: accountingTransactions.id })
      if (!markedReversed) throw conflict("Journal entry was already reversed by another request")
      await transaction.update(resourceRecords).set({
        status: "reversed",
        version: journal.version + 1,
        updatedAt: reversedAt,
        updatedBy: context.principal.userId,
      }).where(and(
        eq(resourceRecords.id, journal.id),
        eq(resourceRecords.companyId, context.companyId),
        eq(resourceRecords.module, "accounting"),
        eq(resourceRecords.resource, "journal-entries"),
        eq(resourceRecords.status, "posted"),
        eq(resourceRecords.isDeleted, false),
      ))
      await transaction.insert(auditEvents).values({
        id: randomUUID(),
        requestId: context.requestId,
        companyId: context.companyId,
        branchId: context.branchId,
        userId: context.principal.userId,
        action: "reverse",
        entityType: "accounting/journal-entries",
        entityId: journal.id,
        changes: { reversalJournalId: reversal.id },
      })
      return postedReversal
    })
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

  async accountLedger(companyId: string, accountId: string, limit: number) {
    const rows = await this.db
      .select({
        transactionId: accountingTransactions.id,
        transactionNumber: accountingTransactions.transactionNumber,
        date: accountingTransactions.transactionDate,
        memo: accountingTransactions.memo,
        description: accountingLines.description,
        debit: accountingLines.debit,
        credit: accountingLines.credit,
        sourceModule: accountingTransactions.sourceModule,
        sourceType: accountingTransactions.sourceType,
        sourceId: accountingTransactions.sourceId,
      })
      .from(accountingLines)
      .innerJoin(
        accountingTransactions,
        eq(accountingLines.transactionId, accountingTransactions.id),
      )
      .where(
        and(
          eq(accountingTransactions.companyId, companyId),
          inTheBooks,
          eq(accountingLines.accountId, accountId),
        ),
      )
      .orderBy(sql`${accountingTransactions.transactionDate} desc`)
      .limit(limit)
    return rows
      .map((row) => ({
        transactionId: row.transactionId,
        transactionNumber: row.transactionNumber,
        date: row.date.toISOString().slice(0, 10),
        memo: row.memo ?? "",
        description: row.description ?? "",
        debit: row.debit,
        credit: row.credit,
        sourceModule: row.sourceModule,
        sourceType: row.sourceType,
        ...(row.sourceId ? { sourceId: row.sourceId } : {}),
      }))
      .reverse()
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
          inTheBooks,
          gte(accountingTransactions.transactionDate, new Date(`${from}T00:00:00.000Z`)),
          lte(accountingTransactions.transactionDate, new Date(`${to}T23:59:59.999Z`)),
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
