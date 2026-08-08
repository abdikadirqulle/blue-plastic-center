import { describe, expect, it, vi } from "vitest"
import {
  AccountResolver,
  type AccountLookup,
  type ResolvedAccount,
} from "../../src/modules/accounting/account-resolver.js"
import {
  PostingProfileResolver,
  type PostingProfileLookup,
} from "../../src/modules/accounting/posting-profile-resolver.js"
import type { PostingProfileDefinition } from "../../src/modules/accounting/posting-profiles.js"
import { systemAccountKeys } from "../../src/modules/accounting/system-accounts.js"

const companyId = "company-1"

const account = (id: string, systemKey: string | null): ResolvedAccount => ({
  id,
  companyId,
  accountNumber: id === "configured-revenue" ? "4015" : "1100",
  name: id,
  systemKey,
  active: true,
  isControlAccount: false,
  allowManualPosting: true,
})

const profile = (overrides: Partial<PostingProfileDefinition> = {}): PostingProfileDefinition => ({
  id: "profile-1",
  companyId,
  code: "invoice",
  name: "Invoice",
  active: true,
  version: 1,
  lines: [
    {
      id: "line-ar",
      role: "receivable",
      side: "debit",
      accountMeaning: systemAccountKeys.ACCOUNTS_RECEIVABLE,
      overrideSource: "customer_receivable_account",
      lineNumber: 1,
    },
    {
      id: "line-revenue",
      role: "revenue",
      side: "credit",
      accountMeaning: systemAccountKeys.SALES_REVENUE,
      overrideSource: "item_income_account",
      lineNumber: 2,
    },
  ],
  ...overrides,
})

function setup(candidate?: PostingProfileDefinition) {
  const findByMeaning = vi.fn(async (_company: string, meaning: string) =>
    account(`meaning:${meaning}`, meaning)
  )
  const findById = vi.fn(async (_company: string, id: string) => account(id, null))
  const accountResolver = new AccountResolver({
    findByMeaning,
    findById,
    findByNumber: async () => undefined,
  } as AccountLookup)
  const lookup: PostingProfileLookup = { find: vi.fn(async () => candidate) }
  return {
    resolver: new PostingProfileResolver(lookup, accountResolver),
    findByMeaning,
    findById,
  }
}

describe("posting profile resolution", () => {
  it("resolves an active company profile through semantic account meanings", async () => {
    const { resolver, findByMeaning } = setup(profile())
    const resolved = await resolver.resolve(companyId, "invoice")
    expect(resolved.lines).toEqual([
      expect.objectContaining({ role: "receivable", resolution: "meaning" }),
      expect.objectContaining({ role: "revenue", resolution: "meaning" }),
    ])
    expect(findByMeaning).toHaveBeenCalledWith(
      companyId,
      systemAccountKeys.ACCOUNTS_RECEIVABLE,
    )
  })

  it("uses only an explicitly allowed configured override", async () => {
    const { resolver, findById } = setup(profile())
    const resolved = await resolver.resolve(companyId, "invoice", {
      item_income_account: "configured-revenue",
    })
    expect(resolved.lines[1]).toMatchObject({
      accountId: "configured-revenue",
      resolution: "configured_override",
    })
    expect(findById).toHaveBeenCalledWith(companyId, "configured-revenue")
  })

  it("fails when the profile is missing", async () => {
    await expect(setup().resolver.resolve(companyId, "invoice"))
      .rejects.toMatchObject({ status: 404 })
  })

  it("fails when the profile is inactive", async () => {
    await expect(setup(profile({ active: false })).resolver.resolve(companyId, "invoice"))
      .rejects.toThrow("inactive")
  })

  it("rejects a profile returned from another company", async () => {
    await expect(setup(profile({ companyId: "company-2" })).resolver.resolve(companyId, "invoice"))
      .rejects.toThrow("not found in this company")
  })

  it("fails when a required configured override has no fallback meaning", async () => {
    const onlyOverride = profile({
      lines: [{
        id: "line-bank",
        role: "transfer_source",
        side: "credit",
        overrideSource: "bank_ledger_account",
        lineNumber: 1,
      }],
    })
    await expect(setup(onlyOverride).resolver.resolve(companyId, "invoice"))
      .rejects.toThrow("requires configured bank_ledger_account")
  })

  it("rejects unknown events rather than selecting another profile", async () => {
    await expect(setup(profile()).resolver.resolve(companyId, "unknown"))
      .rejects.toMatchObject({ status: 422 })
  })
})
