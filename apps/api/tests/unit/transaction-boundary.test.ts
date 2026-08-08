import { describe, expect, it, vi } from "vitest"
import type { Database, DatabaseTransaction } from "../../src/db/client.js"
import type { TransactionalLedgerRepository } from "../../src/modules/accounting/ledger-repository.js"
import type { PostingCommand, PostingResult } from "../../src/modules/accounting/posting-engine.js"
import { PostgresLedgerRepository } from "../../src/modules/accounting/postgres-ledger-repository.js"
import type { RequestContext } from "../../src/platform/types.js"

const context: RequestContext = {
  requestId: "composition-test",
  companyId: "00000000-0000-4000-8000-000000000001",
  branchId: "00000000-0000-4000-8000-000000000011",
  principal: {
    userId: "00000000-0000-4000-8000-000000000001",
    name: "Administrator",
    role: "administrator",
  },
}

const command: PostingCommand = {
  sourceModule: "test",
  sourceType: "composition",
  sourceId: "70000000-0000-4000-8000-000000000001",
  postingKind: "primary",
  idempotencyKey: "composition-1",
  transactionDate: "2026-07-28",
  currency: "USD",
  lines: [
    { accountId: "10000000-0000-4000-8000-000000000001", debit: "1.0000", credit: "0" },
    { accountId: "10000000-0000-4000-8000-000000000002", debit: "0", credit: "1.0000" },
  ],
}

const result: PostingResult = {
  transactionId: "71000000-0000-4000-8000-000000000001",
  transactionNumber: "JOU-COMPOSE",
  status: "posted",
  sourceModule: command.sourceModule,
  sourceType: command.sourceType,
  sourceId: command.sourceId,
  postingKind: "primary",
  postingFingerprint: "fingerprint",
  fiscalPeriodId: "72000000-0000-4000-8000-000000000001",
}

describe("Accounting Core transaction boundary", () => {
  it("keeps standalone posting transaction-owned by Accounting Core", async () => {
    const callerTransaction = {} as DatabaseTransaction
    const transaction = vi.fn(async (work: (tx: DatabaseTransaction) => Promise<PostingResult>) =>
      work(callerTransaction))
    const repository = new PostgresLedgerRepository({ transaction } as unknown as Database)
    const delegated = vi.spyOn(repository, "postInTransaction").mockResolvedValue(result)

    await expect(repository.post(context, command)).resolves.toEqual(result)
    expect(transaction).toHaveBeenCalledOnce()
    expect(delegated).toHaveBeenCalledWith(callerTransaction, context, command)
  })

  it("exposes caller-owned posting without opening an independent transaction", async () => {
    const transaction = vi.fn()
    const repository: TransactionalLedgerRepository = new PostgresLedgerRepository(
      { transaction } as unknown as Database,
    )
    const callerTransaction = {} as DatabaseTransaction
    const delegated = vi.spyOn(repository, "postInTransaction").mockResolvedValue(result)

    await expect(repository.postInTransaction(callerTransaction, context, command))
      .resolves.toEqual(result)
    expect(delegated).toHaveBeenCalledWith(callerTransaction, context, command)
    expect(transaction).not.toHaveBeenCalled()
  })
})
