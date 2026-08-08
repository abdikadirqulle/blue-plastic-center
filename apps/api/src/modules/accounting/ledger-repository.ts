import type { RequestContext, ResourceRecord } from "../../platform/types.js"
import type { PostingCommand, PostingResult } from "./posting-engine.js"
import type { SystemAccountKey } from "./system-accounts.js"

export interface ResolvedLedgerAccount {
  id: string
  accountNumber: string
  name: string
}

export interface TrialBalanceRow {
  accountId: string
  accountNumber?: string
  accountName?: string
  accountType?: string
  debit: string
  credit: string
  balance: string
}

/** One posted ledger line, as an account register shows it. */
export interface AccountLedgerLine {
  transactionId: string
  transactionNumber: string
  date: string
  memo: string
  description: string
  debit: string
  credit: string
  sourceModule: string
  sourceType: string
  sourceId?: string
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
  resolveAccountMeaning(
    companyId: string,
    meaning: SystemAccountKey,
  ): Promise<ResolvedLedgerAccount>
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
  /** Posted lines for one account, oldest first, for the account register. */
  accountLedger(
    companyId: string,
    accountId: string,
    limit: number,
  ): Promise<AccountLedgerLine[]>
}
