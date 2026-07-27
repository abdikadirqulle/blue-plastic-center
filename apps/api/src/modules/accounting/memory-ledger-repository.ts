import { randomUUID } from "node:crypto"
import { conflict } from "../../platform/errors.js"
import type { RequestContext, ResourceRecord } from "../../platform/types.js"
import type { ResourceRepository } from "../../repositories/resource-repository.js"
import { assertBalanced, decimalToMinor, minorToDecimal } from "./ledger-math.js"
import type { LedgerRepository } from "./ledger-repository.js"

interface PostedJournal {
  record: ResourceRecord
  date: string
  lines: Array<Record<string, unknown>>
}

export class MemoryLedgerRepository implements LedgerRepository {
  private readonly posted: PostedJournal[] = []
  private readonly closedPeriods = new Map<string, { startDate: string; endDate: string }>()

  constructor(private readonly resources: ResourceRepository) {}

  async postJournal(context: RequestContext, journal: ResourceRecord) {
    if (journal.status === "posted") throw conflict("Journal entry is already posted")
    const date = String(journal.data.journalDate)
    if ([...this.closedPeriods.values()].some((period) => date >= period.startDate && date <= period.endDate)) {
      throw conflict("The fiscal period is closed")
    }
    const lines = journal.data.lines as Array<Record<string, unknown>>
    assertBalanced(lines)
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
    this.posted.push({ record: posted, date, lines })
    return posted
  }

  async reverseJournal(context: RequestContext, journal: ResourceRecord, reversalDate: string, memo?: string) {
    if (journal.status !== "posted") throw conflict("Only posted journals can be reversed")
    const source = this.posted.find((entry) => entry.record.id === journal.id)
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
    return this.postJournal(context, reversal)
  }

  async closePeriod(_context: RequestContext, input: { name: string; startDate: string; endDate: string }) {
    this.closedPeriods.set(input.name, { startDate: input.startDate, endDate: input.endDate })
  }

  async reopenPeriod(_context: RequestContext, name: string) {
    this.closedPeriods.delete(name)
  }

  async trialBalance(companyId: string, from: string, to: string) {
    const totals = new Map<string, { debit: bigint; credit: bigint }>()
    for (const journal of this.posted.filter((entry) =>
      entry.record.companyId === companyId && entry.date >= from && entry.date <= to
    )) {
      for (const line of journal.lines) {
        const accountId = String(line.accountId)
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
