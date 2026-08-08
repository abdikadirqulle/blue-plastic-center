import { describe, expect, it } from "vitest"
import { MemoryLedgerRepository } from "../../src/modules/accounting/memory-ledger-repository.js"
import {
  postingFingerprint,
  validatePostingCommand,
  type PostingCommand,
} from "../../src/modules/accounting/posting-engine.js"
import type { RequestContext } from "../../src/platform/types.js"
import { MemoryResourceRepository } from "../../src/repositories/memory-resource-repository.js"
import { systemAccountKeys } from "../../src/modules/accounting/system-accounts.js"

const context: RequestContext = {
  requestId: "posting-test",
  companyId: "company-1",
  branchId: "branch-1",
  principal: { userId: "admin-1", name: "Administrator", role: "administrator" },
}

const command = (overrides: Partial<PostingCommand> = {}): PostingCommand => ({
  sourceModule: "sales",
  sourceType: "invoice",
  sourceId: "50000000-0000-4000-8000-000000000001",
  postingKind: "primary",
  idempotencyKey: "post-invoice-1",
  transactionDate: "2026-07-28",
  currency: "USD",
  exchangeRate: "1",
  lines: [
    { systemAccountKey: systemAccountKeys.ACCOUNTS_RECEIVABLE, debit: "100.0000", credit: "0" },
    { systemAccountKey: systemAccountKeys.SALES_REVENUE, debit: "0", credit: "100.0000" },
  ],
  ...overrides,
})

describe("central posting command", () => {
  it.each([
    [{ transactionDate: "2026-02-30" }, "date"],
    [{ transactionDate: "07/28/2026" }, "date"],
    [{ exchangeRate: "0" }, "exchange rate"],
    [{ exchangeRate: "1.123456789" }, "exchange rate"],
    [{ postingKind: "reversal" }, "reversal transaction reference"],
    [{ reversalOfId: "60000000-0000-4000-8000-000000000001" }, "reversal transaction reference"],
    [{ sourceVersion: 0 }, "source version"],
    [{ sourceVersion: 1.5 }, "source version"],
    [{ sourceVersion: Number.MAX_SAFE_INTEGER + 1 }, "source version"],
  ])("rejects invalid posting metadata %#", (overrides, message) => {
    expect(() => validatePostingCommand(command(overrides))).toThrow(message)
  })

  it("includes source type and posting kind in the posting fingerprint", () => {
    const base = postingFingerprint(context.companyId, command())
    expect(postingFingerprint(context.companyId, command({ sourceType: "payment" }))).not.toBe(base)
    expect(postingFingerprint(context.companyId, command({ postingKind: "adjustment" }))).not.toBe(base)
  })

  it("keeps source version out of the established posting fingerprint", () => {
    expect(postingFingerprint(context.companyId, command({ sourceVersion: 1 })))
      .toBe(postingFingerprint(context.companyId, command({ sourceVersion: 2 })))
  })

  it("returns an idempotent result and rejects source duplicates", async () => {
    const ledger = new MemoryLedgerRepository(new MemoryResourceRepository())
    const first = await ledger.post(context, command())
    expect(first).toMatchObject({
      fiscalPeriodId: "memory-open-period",
      postingFingerprint: postingFingerprint(context.companyId, command()),
    })
    await expect(ledger.post(context, command())).resolves.toEqual(first)
    await expect(ledger.post(context, command({ idempotencyKey: "different-key" })))
      .rejects.toMatchObject({ status: 409, code: "CONFLICT" })
    await expect(ledger.post(context, command({ memo: "changed" })))
      .rejects.toMatchObject({ status: 409, code: "CONFLICT" })
  })

  it("treats a changed source version as a changed idempotent request", async () => {
    const ledger = new MemoryLedgerRepository(new MemoryResourceRepository())
    const versioned = command({ sourceVersion: 3 })
    const first = await ledger.post(context, versioned)
    expect(first.sourceVersion).toBe(3)
    await expect(ledger.post(context, versioned)).resolves.toEqual(first)
    await expect(ledger.post(context, command({ sourceVersion: 4 })))
      .rejects.toMatchObject({ status: 409, code: "CONFLICT" })
  })

  it("retries the same reversal without duplicating or changing the original", async () => {
    const ledger = new MemoryLedgerRepository(new MemoryResourceRepository())
    const primary = await ledger.post(context, command())
    const originalLines = structuredClone(ledger.linesOf(primary.transactionId))
    const reversalInput = {
      sourceModule: "sales",
      sourceType: "invoice",
      sourceId: command().sourceId,
      reversalDate: "2026-07-29",
      idempotencyKey: "reverse-invoice-1",
      memo: "Customer cancellation",
    }

    const first = await ledger.reverseTransaction(context, reversalInput)
    const retry = await ledger.reverseTransaction(context, reversalInput)
    const reversal = ledger.findPosting(context.companyId, command(), "reversal")

    expect(retry).toEqual(first)
    expect(reversal?.record.data).toMatchObject({
      currency: "USD",
      exchangeRate: "1",
      reversalOfId: primary.transactionId,
      memo: "Customer cancellation",
    })
    expect(ledger.linesOf(primary.transactionId)).toEqual(originalLines)
    expect(ledger.linesOf(first.transactionId)).toEqual([
      { accountId: systemAccountKeys.ACCOUNTS_RECEIVABLE, debit: "0.0000", credit: "100.0000" },
      { accountId: systemAccountKeys.SALES_REVENUE, debit: "100.0000", credit: "0.0000" },
    ])
  })

  it("rejects a changed reversal retry and a second distinct reversal", async () => {
    const ledger = new MemoryLedgerRepository(new MemoryResourceRepository())
    await ledger.post(context, command())
    const reversal = {
      sourceModule: "sales",
      sourceType: "invoice",
      sourceId: command().sourceId,
      reversalDate: "2026-07-29",
      idempotencyKey: "reverse-invoice-1",
      memo: "Customer cancellation",
    }
    await ledger.reverseTransaction(context, reversal)

    await expect(ledger.reverseTransaction(context, {
      ...reversal,
      reversalDate: "2026-07-30",
    })).rejects.toMatchObject({ status: 409, code: "CONFLICT" })
    await expect(ledger.reverseTransaction(context, {
      ...reversal,
      idempotencyKey: "reverse-invoice-2",
    })).rejects.toMatchObject({ status: 409, code: "CONFLICT" })
  })

  it("leaves no reversal fact when period validation fails", async () => {
    const ledger = new MemoryLedgerRepository(new MemoryResourceRepository())
    const primary = await ledger.post(context, command())
    await ledger.closePeriod(context, {
      name: "July 2026",
      startDate: "2026-07-29",
      endDate: "2026-07-29",
    })

    await expect(ledger.reverseTransaction(context, {
      sourceModule: "sales",
      sourceType: "invoice",
      sourceId: command().sourceId,
      reversalDate: "2026-07-29",
      idempotencyKey: "reverse-closed-period",
    })).rejects.toMatchObject({ status: 409, code: "CONFLICT" })
    expect(ledger.findPosting(context.companyId, command(), "reversal")).toBeUndefined()
    expect(ledger.linesOf(primary.transactionId)).toHaveLength(2)
  })
})
