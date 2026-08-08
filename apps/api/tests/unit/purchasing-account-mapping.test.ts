import { describe, expect, it } from "vitest"
import { resolveBillPostingAccounts } from "../../src/modules/purchasing/purchasing.routes.js"
import { systemAccountKeys } from "../../src/modules/accounting/system-accounts.js"

describe("purchasing account mapping", () => {
  it("uses a configured expense account and the typed payable meaning", () => {
    expect(resolveBillPostingAccounts([
      { accountId: "expense-account-id", quantity: "2", unitPrice: "10" },
      { accountId: "expense-account-id", quantity: "1", unitPrice: "5" },
    ])).toEqual({
      debitAccount: { accountId: "expense-account-id" },
      creditAccount: { systemAccountKey: systemAccountKeys.ACCOUNTS_PAYABLE },
    })
  })

  it.each([
    { lines: [{ itemId: "unmapped-item", quantity: "1", unitPrice: "10" }] },
    { lines: [
      { accountId: "expense-1", quantity: "1", unitPrice: "10" },
      { accountId: "expense-2", quantity: "1", unitPrice: "10" },
    ] },
  ])("fails instead of selecting an arbitrary expense account", ({ lines }) => {
    expect(() => resolveBillPostingAccounts(lines)).toThrow(
      "requires one configured expense account",
    )
  })
})
