import { describe, expect, it } from "vitest"
import { MemoryLedgerRepository } from "../../src/modules/accounting/memory-ledger-repository.js"
import {
  postingFingerprint,
  validatePostingCommand,
  type PostingCommand,
} from "../../src/modules/accounting/posting-engine.js"
import type { RequestContext } from "../../src/platform/types.js"
import { MemoryResourceRepository } from "../../src/repositories/memory-resource-repository.js"

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
    { systemAccountKey: "ACCOUNTS_RECEIVABLE", debit: "100.0000", credit: "0" },
    { systemAccountKey: "SALES_REVENUE", debit: "0", credit: "100.0000" },
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
  ])("rejects invalid posting metadata %#", (overrides, message) => {
    expect(() => validatePostingCommand(command(overrides))).toThrow(message)
  })

  it("includes source type and posting kind in the posting fingerprint", () => {
    const base = postingFingerprint(context.companyId, command())
    expect(postingFingerprint(context.companyId, command({ sourceType: "payment" }))).not.toBe(base)
    expect(postingFingerprint(context.companyId, command({ postingKind: "adjustment" }))).not.toBe(base)
  })

  it("returns an idempotent result and rejects source duplicates", async () => {
    const ledger = new MemoryLedgerRepository(new MemoryResourceRepository())
    const first = await ledger.post(context, command())
    await expect(ledger.post(context, command())).resolves.toEqual(first)
    await expect(ledger.post(context, command({ idempotencyKey: "different-key" })))
      .rejects.toMatchObject({ status: 409, code: "CONFLICT" })
    await expect(ledger.post(context, command({ memo: "changed" })))
      .rejects.toMatchObject({ status: 409, code: "CONFLICT" })
  })
})
