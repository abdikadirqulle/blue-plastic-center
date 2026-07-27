import type { RequestContext, ResourceRecord } from "../../platform/types.js"

export interface TrialBalanceRow {
  accountId: string
  accountNumber?: string
  accountName?: string
  accountType?: string
  debit: string
  credit: string
  balance: string
}

export interface LedgerRepository {
  postJournal(context: RequestContext, journal: ResourceRecord): Promise<ResourceRecord>
  reverseJournal(context: RequestContext, journal: ResourceRecord, reversalDate: string, memo?: string): Promise<ResourceRecord>
  closePeriod(context: RequestContext, input: { name: string; startDate: string; endDate: string }): Promise<void>
  reopenPeriod(context: RequestContext, name: string): Promise<void>
  trialBalance(companyId: string, from: string, to: string): Promise<TrialBalanceRow[]>
}
