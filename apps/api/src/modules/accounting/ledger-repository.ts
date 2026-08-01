import type { RequestContext, ResourceRecord } from "../../platform/types.js"
import type { PostingCommand, PostingResult } from "./posting-engine.js"

export interface TrialBalanceRow {
  accountId: string
  accountNumber?: string
  accountName?: string
  accountType?: string
  debit: string
  credit: string
  balance: string
}

export interface SourceReversalInput {
  sourceModule: string
  sourceType: string
  sourceId: string
  reversalDate: string
  idempotencyKey: string
  memo?: string
}

export interface LedgerRepository {
  post(context: RequestContext, command: PostingCommand): Promise<PostingResult>
  /** Reverses the primary posting of a source document, such as an invoice. */
  reverseTransaction(
    context: RequestContext,
    input: SourceReversalInput,
  ): Promise<PostingResult>
  postJournal(context: RequestContext, journal: ResourceRecord): Promise<ResourceRecord>
  reverseJournal(context: RequestContext, journal: ResourceRecord, reversalDate: string, memo?: string): Promise<ResourceRecord>
  closePeriod(context: RequestContext, input: { name: string; startDate: string; endDate: string }): Promise<void>
  reopenPeriod(context: RequestContext, name: string): Promise<void>
  trialBalance(companyId: string, from: string, to: string): Promise<TrialBalanceRow[]>
}
