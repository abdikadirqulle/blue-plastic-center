import { describe, expect, it } from "vitest"
import {
  AccountResolver,
  type AccountLookup,
  type ResolvedAccount,
} from "../../src/modules/accounting/account-resolver.js"
import {
  isSystemAccountKey,
  systemAccountKeys,
} from "../../src/modules/accounting/system-accounts.js"

const companyId = "company-1"
const otherCompanyId = "company-2"

const account = (overrides: Partial<ResolvedAccount> = {}): ResolvedAccount => ({
  id: "account-1",
  companyId,
  accountNumber: "1100",
  name: "Accounts Receivable",
  systemKey: systemAccountKeys.ACCOUNTS_RECEIVABLE,
  active: true,
  isControlAccount: false,
  allowManualPosting: true,
  ...overrides,
})

const resolverWith = (candidate?: ResolvedAccount) => new AccountResolver({
  findByMeaning: async () => candidate,
  findById: async () => candidate,
  findByNumber: async () => candidate,
} satisfies AccountLookup)

describe("account meaning registry", () => {
  it.each(Object.values(systemAccountKeys))("recognizes core meaning %s", (meaning) => {
    expect(isSystemAccountKey(meaning)).toBe(true)
  })

  it("rejects an unknown meaning", async () => {
    await expect(resolverWith(account()).resolveMeaning(companyId, "mystery_account"))
      .rejects.toMatchObject({ status: 422, code: "VALIDATION_ERROR" })
  })
})

describe("account resolver", () => {
  it("resolves a valid active company meaning", async () => {
    await expect(resolverWith(account()).resolveMeaning(
      companyId,
      systemAccountKeys.ACCOUNTS_RECEIVABLE,
    )).resolves.toMatchObject({ id: "account-1", companyId })
  })

  it("fails when a meaning mapping is missing", async () => {
    await expect(resolverWith().resolveMeaning(
      companyId,
      systemAccountKeys.ACCOUNTS_PAYABLE,
    )).rejects.toMatchObject({ status: 404 })
  })

  it("rejects an inactive meaning account", async () => {
    await expect(resolverWith(account({ active: false })).resolveMeaning(
      companyId,
      systemAccountKeys.ACCOUNTS_RECEIVABLE,
    )).rejects.toThrow("inactive")
  })

  it("rejects another company's meaning account", async () => {
    await expect(resolverWith(account({ companyId: otherCompanyId })).resolveMeaning(
      companyId,
      systemAccountKeys.ACCOUNTS_RECEIVABLE,
    )).rejects.toThrow("not found in this company")
  })

  it("validates an active explicit company account", async () => {
    await expect(resolverWith(account()).validateExplicitAccount(companyId, "account-1"))
      .resolves.toMatchObject({ id: "account-1" })
  })

  it.each([
    account({ companyId: otherCompanyId }),
    account({ active: false }),
  ])("rejects a cross-company or inactive explicit account", async (candidate) => {
    await expect(resolverWith(candidate).validateExplicitAccount(companyId, candidate.id))
      .rejects.toBeInstanceOf(Error)
  })

  it("preserves manual control-account protection", () => {
    expect(() => resolverWith().assertManualPostingAllowed(account({
      isControlAccount: true,
      allowManualPosting: false,
    }))).toThrow("does not allow manual posting")
  })

  it("retains validated legacy account-number compatibility", async () => {
    await expect(resolverWith(account()).resolveLegacyAccountNumber(companyId, "1100"))
      .resolves.toMatchObject({ accountNumber: "1100" })
  })
})
