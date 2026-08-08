import { randomUUID } from "node:crypto"
import { conflict, notFound } from "../../platform/errors.js"
import type { RequestContext, ResourceRecord } from "../../platform/types.js"
import type { ResourceRepository } from "../../repositories/resource-repository.js"
import { decimalToMinor, minorToDecimal } from "./ledger-math.js"
import type { LedgerRepository, SourceReversalInput } from "./ledger-repository.js"
import type { SystemAccountKey } from "./system-accounts.js"
import {
  createReversalCommand,
  postingFingerprint,
  postingRequestHash,
  validatePostingCommand,
  type PostingCommand,
  type PostingResult,
} from "./posting-engine.js"

/** However a line names its account, that name is its trial-balance key. */
function postingAccountReference(line: Record<string, unknown>) {
  return String(line.accountId ?? line.accountNumber ?? line.systemAccountKey ?? "")
}

interface PostedJournal {
  record: ResourceRecord
  date: string
  lines: Array<Record<string, unknown>>
}

export class MemoryLedgerRepository implements LedgerRepository {
  private posted: PostedJournal[] = []
  private reversedJournalIds = new Set<string>()
  private postingResults = new Map<string, { requestHash: string; result: PostingResult }>()
  private postingSources = new Set<string>()
  private readonly reversedTransactionIds = new Set<string>()
  private readonly closedPeriods = new Map<string, { startDate: string; endDate: string }>()

  constructor(private readonly resources: ResourceRepository) {}

  async resolveAccountMeaning(_companyId: string, meaning: SystemAccountKey) {
    return { id: meaning, accountNumber: meaning, name: meaning }
  }

  /** Captures ledger state so a failed business action can be rolled back. */
  snapshot() {
    const posted = [...this.posted]
    const reversedJournalIds = new Set(this.reversedJournalIds)
    const postingResults = new Map(this.postingResults)
    const postingSources = new Set(this.postingSources)
    return () => {
      this.posted = posted
      this.reversedJournalIds = reversedJournalIds
      this.postingResults = postingResults
      this.postingSources = postingSources
    }
  }

  /** Read model for the invoice detail view and for posting assertions. */
  findPosting(
    companyId: string,
    source: { sourceModule: string; sourceType: string; sourceId: string },
    postingKind = "primary",
  ) {
    return this.posted.find((entry) => {
      const command = entry.record.data as unknown as PostingCommand
      return (
        entry.record.companyId === companyId &&
        command.sourceModule === source.sourceModule &&
        command.sourceType === source.sourceType &&
        command.sourceId === source.sourceId &&
        (command.postingKind ?? "primary") === postingKind
      )
    })
  }

  linesOf(transactionId: string) {
    return this.posted.find((entry) => entry.record.id === transactionId)?.lines ?? []
  }

  async reverseTransaction(context: RequestContext, input: SourceReversalInput) {
    const original = this.findPosting(context.companyId, input)
    if (!original) throw notFound("A posted transaction for this document was not found")
    if (this.reversedTransactionIds.has(original.record.id))
      throw conflict("The transaction was already reversed by another request")
    const command = original.record.data as unknown as PostingCommand
    const result = await this.post(
      context,
      createReversalCommand({
        original: {
          transactionId: original.record.id,
          sourceModule: input.sourceModule,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          currency: command.currency,
          exchangeRate: command.exchangeRate ?? "1",
          lines: original.lines.map((line) => ({
            accountId: String(line.accountId ?? line.systemAccountKey),
            description: line.description ? String(line.description) : undefined,
            debit: String(line.debit ?? "0"),
            credit: String(line.credit ?? "0"),
          })),
        },
        reversalDate: input.reversalDate,
        idempotencyKey: input.idempotencyKey,
        memo: input.memo ?? `Reversal of ${original.record.id}`,
      }),
    )
    this.reversedTransactionIds.add(original.record.id)
    original.record.status = "reversed"
    return result
  }

  async post(context: RequestContext, command: PostingCommand) {
    validatePostingCommand(command)
    if ([...this.closedPeriods.values()].some((period) =>
      command.transactionDate >= period.startDate && command.transactionDate <= period.endDate
    )) throw conflict("The fiscal period is closed")
    const requestHash = postingRequestHash(command)
    const known = this.postingResults.get(`${context.companyId}:${command.idempotencyKey}`)
    if (known) {
      if (known.requestHash !== requestHash)
        throw conflict("Posting idempotency key was reused with a different request")
      return known.result
    }
    const sourceKey = [context.companyId, command.sourceModule, command.sourceType,
      command.sourceId, command.postingKind ?? "primary"].join(":")
    if (this.postingSources.has(sourceKey)) throw conflict("Source transaction posting already exists")
    const transactionId = randomUUID()
    const result: PostingResult = {
      transactionId,
      transactionNumber: `JOU-${transactionId.slice(0, 8).toUpperCase()}`,
      status: "posted",
      sourceModule: command.sourceModule,
      sourceType: command.sourceType,
      sourceId: command.sourceId,
      postingKind: command.postingKind ?? "primary",
      postingFingerprint: postingFingerprint(context.companyId, command),
    }
    const now = new Date().toISOString()
    this.posted.push({
      date: command.transactionDate,
      lines: command.lines as unknown as Array<Record<string, unknown>>,
      record: {
        id: transactionId, companyId: context.companyId, branchId: context.branchId,
        module: "accounting", resource: "journal-entries", status: "posted", version: 1,
        data: command as unknown as Record<string, unknown>, createdAt: now, updatedAt: now,
        createdBy: context.principal.userId, updatedBy: context.principal.userId, isDeleted: false,
      },
    })
    this.postingSources.add(sourceKey)
    this.postingResults.set(`${context.companyId}:${command.idempotencyKey}`, { requestHash, result })
    return result
  }

  async postJournal(context: RequestContext, journal: ResourceRecord) {
    if (journal.status !== "draft") throw conflict("Only draft journal entries can be posted")
    if (journal.data.reversalOfId) throw conflict("Use the secured reversal endpoint")
    const date = String(journal.data.journalDate)
    const lines = journal.data.lines as Array<Record<string, unknown>>
    await this.post(context, {
      sourceModule: "accounting",
      sourceType: "journal",
      sourceId: journal.id,
      postingKind: "primary",
      idempotencyKey: `journal:${journal.id}`,
      transactionDate: date,
      currency: String(journal.data.currency ?? "USD"),
      exchangeRate: String(journal.data.exchangeRate ?? "1"),
      memo: journal.data.memo ? String(journal.data.memo) : undefined,
      lines: lines.map((line) => ({
        accountId: String(line.accountId),
        description: line.description ? String(line.description) : undefined,
        debit: String(line.debit ?? "0"),
        credit: String(line.credit ?? "0"),
      })),
    })
    const posted = {
      ...journal,
      status: "posted",
      version: journal.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: context.principal.userId,
    }
    await this.resources.update(posted)
    await this.resources.appendAudit({
      id: randomUUID(),
      requestId: context.requestId,
      companyId: context.companyId,
      branchId: context.branchId,
      userId: context.principal.userId,
      action: "post",
      entityType: "accounting/journal-entries",
      entityId: journal.id,
      occurredAt: new Date().toISOString(),
    })
    return posted
  }

  async reverseJournal(context: RequestContext, journal: ResourceRecord, reversalDate: string, memo?: string) {
    if (journal.status !== "posted") throw conflict("Only posted journals can be reversed")
    if (this.reversedJournalIds.has(journal.id)) throw conflict("Journal entry is already reversed")
    const source = this.posted.find((entry) => entry.record.data.sourceId === journal.id)
    if (!source) throw conflict("Posted ledger transaction was not found")
    const reversal: ResourceRecord = {
      ...journal,
      id: randomUUID(),
      status: "draft",
      version: 1,
      data: {
        journalDate: reversalDate,
        memo: memo ?? `Reversal of ${journal.id}`,
        reversalOfId: journal.id,
        lines: source.lines.map((line) => ({
          ...line,
          debit: String(line.credit ?? "0"),
          credit: String(line.debit ?? "0"),
        })),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: context.principal.userId,
      updatedBy: context.principal.userId,
    }
    await this.resources.create(reversal)
    await this.post(context, {
      sourceModule: "accounting",
      sourceType: "journal",
      sourceId: journal.id,
      postingKind: "reversal",
      idempotencyKey: `reversal:${source.record.id}`,
      transactionDate: reversalDate,
      currency: String(journal.data.currency ?? "USD"),
      exchangeRate: String(journal.data.exchangeRate ?? "1"),
      memo: memo ?? `Reversal of ${journal.id}`,
      reversalOfId: source.record.id,
      lines: reversal.data.lines as PostingCommand["lines"],
    })
    const posted = {
      ...reversal,
      status: "posted",
      version: reversal.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: context.principal.userId,
    }
    await this.resources.update(posted)
    this.reversedJournalIds.add(journal.id)
    await this.resources.update({
      ...journal,
      status: "reversed",
      version: journal.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: context.principal.userId,
    })
    return posted
  }

  async closePeriod(_context: RequestContext, input: { name: string; startDate: string; endDate: string }) {
    this.closedPeriods.set(input.name, { startDate: input.startDate, endDate: input.endDate })
  }

  async reopenPeriod(_context: RequestContext, name: string) {
    this.closedPeriods.delete(name)
  }

  async accountLedger(companyId: string, accountId: string, limit: number) {
    const aliases = await this.accountAliases(companyId, accountId)
    const lines = this.posted
      .filter((entry) => entry.record.companyId === companyId)
      .flatMap((entry) => {
        const command = entry.record.data as unknown as PostingCommand
        return entry.lines
          .filter((line) => aliases.has(postingAccountReference(line)))
          .map((line) => ({
            transactionId: entry.record.id,
            transactionNumber: `JOU-${entry.record.id.slice(0, 8).toUpperCase()}`,
            date: entry.date,
            memo: command.memo ?? "",
            description: line.description ? String(line.description) : "",
            debit: String(line.debit ?? "0"),
            credit: String(line.credit ?? "0"),
            sourceModule: command.sourceModule,
            sourceType: command.sourceType,
            ...(command.sourceId ? { sourceId: command.sourceId } : {}),
          }))
      })
      .sort((left, right) => left.date.localeCompare(right.date))
    return lines.slice(-limit)
  }

  /**
   * A posting line names an account by id, by number or by system key. All
   * three point at the same account, so the register accepts any of them.
   */
  private async accountAliases(companyId: string, accountId: string) {
    const account = await this.resources.findById(
      { companyId, module: "accounting", resource: "chart-of-accounts" },
      accountId,
    )
    return new Set(
      [
        accountId,
        String(account?.data.accountNumber ?? ""),
        String(account?.data.systemKey ?? ""),
      ].filter(Boolean),
    )
  }

  async trialBalance(companyId: string, from: string, to: string) {
    const totals = new Map<string, { debit: bigint; credit: bigint }>()
    for (const journal of this.posted.filter((entry) =>
      entry.record.companyId === companyId && entry.date >= from && entry.date <= to
    )) {
      for (const line of journal.lines) {
        const accountId = postingAccountReference(line)
        const current = totals.get(accountId) ?? { debit: 0n, credit: 0n }
        current.debit += decimalToMinor(line.debit)
        current.credit += decimalToMinor(line.credit)
        totals.set(accountId, current)
      }
    }
    return [...totals.entries()].map(([accountId, total]) => ({
      accountId,
      accountNumber: accountId,
      debit: minorToDecimal(total.debit),
      credit: minorToDecimal(total.credit),
      balance: minorToDecimal(total.debit - total.credit),
    }))
  }
}
