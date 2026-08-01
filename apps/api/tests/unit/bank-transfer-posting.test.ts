import { describe, expect, it } from "vitest"
import {
  mapBankTransferPosting,
  type BankTransferPostingInput,
  type TransferPostingAccount,
} from "../../src/modules/banking/bank-transfer-posting.js"
import { assertBalanced, decimalToMinor } from "../../src/modules/accounting/ledger-math.js"

const transferId = "10000000-0000-4000-8000-000000000001"
const sourceLedgerId = "10000000-0000-4000-8000-000000000002"
const destinationLedgerId = "10000000-0000-4000-8000-000000000003"
const feeLedgerId = "10000000-0000-4000-8000-000000000004"

function account(
  overrides: Partial<TransferPostingAccount> & Pick<TransferPostingAccount, "id" | "ledgerAccountId">,
): TransferPostingAccount {
  return {
    companyId: "company-1",
    branchId: "branch-1",
    currency: "USD",
    accountKind: "bank",
    ledgerClassification: "asset",
    active: true,
    ...overrides,
  }
}

function input(overrides: Partial<BankTransferPostingInput> = {}): BankTransferPostingInput {
  return {
    id: transferId,
    companyId: "company-1",
    branchId: "branch-1",
    idempotencyKey: `bank-transfer:${transferId}:post`,
    transferDate: "2026-08-01",
    currency: "USD",
    amount: "18.5031",
    fromAccount: account({
      id: "10000000-0000-4000-8000-000000000010",
      ledgerAccountId: sourceLedgerId,
      availableToTransfer: "100.0000",
    }),
    toAccount: account({
      id: "10000000-0000-4000-8000-000000000011",
      ledgerAccountId: destinationLedgerId,
    }),
    ...overrides,
  }
}

describe("bank transfer posting mapping", () => {
  it("posts a same-currency transfer only between balance-sheet accounts", () => {
    const command = mapBankTransferPosting(input())

    expect(command).toMatchObject({
      sourceModule: "banking",
      sourceType: "transfer",
      sourceId: transferId,
      currency: "USD",
      exchangeRate: "1.0000",
      lines: [
        { accountId: destinationLedgerId, debit: "18.5031", credit: "0.0000" },
        { accountId: sourceLedgerId, debit: "0.0000", credit: "18.5031" },
      ],
    })
    expect(assertBalanced(command.lines as unknown as Array<Record<string, unknown>>)).toEqual({
      debit: 185_031n,
      credit: 185_031n,
    })
  })

  it("adds an explicit fee expense without treating the transferred amount as expense", () => {
    const command = mapBankTransferPosting(input({
      amount: "18.5031",
      fee: {
        amount: "0.0069",
        expenseAccount: {
          companyId: "company-1",
          branchId: "branch-1",
          ledgerAccountId: feeLedgerId,
          ledgerClassification: "expense",
          active: true,
        },
      },
    }))

    expect(command.lines).toEqual([
      expect.objectContaining({ accountId: destinationLedgerId, debit: "18.5031" }),
      expect.objectContaining({ accountId: feeLedgerId, debit: "0.0069" }),
      expect.objectContaining({ accountId: sourceLedgerId, credit: "18.5100" }),
    ])
    expect(assertBalanced(command.lines as unknown as Array<Record<string, unknown>>)).toEqual({
      debit: 185_100n,
      credit: 185_100n,
    })
  })

  it("keeps fixed-point precision for values unsafe for JavaScript number arithmetic", () => {
    const amount = "9007199254740991.1234"
    const command = mapBankTransferPosting(input({
      amount,
      fromAccount: account({
        id: "10000000-0000-4000-8000-000000000010",
        ledgerAccountId: sourceLedgerId,
        allowsOverdraft: true,
      }),
    }))

    expect(command.lines[0]?.debit).toBe(amount)
    expect(command.lines[1]?.credit).toBe(amount)
    expect(decimalToMinor(command.lines[0]?.debit)).toBe(90_071_992_547_409_911_234n)
  })

  it("rejects cross-company, cross-currency, cross-branch, and inactive account mappings", () => {
    expect(() => mapBankTransferPosting(input({
      toAccount: account({
        id: "10000000-0000-4000-8000-000000000011",
        ledgerAccountId: destinationLedgerId,
        companyId: "company-2",
      }),
    }))).toThrow("does not belong to the transfer company")

    expect(() => mapBankTransferPosting(input({
      toAccount: account({
        id: "10000000-0000-4000-8000-000000000011",
        ledgerAccountId: destinationLedgerId,
        currency: "EUR",
      }),
    }))).toThrow("currency must match")

    expect(() => mapBankTransferPosting(input({
      toAccount: account({
        id: "10000000-0000-4000-8000-000000000011",
        ledgerAccountId: destinationLedgerId,
        branchId: "branch-2",
      }),
    }))).toThrow("does not belong to the transfer branch")

    expect(() => mapBankTransferPosting(input({
      fromAccount: account({
        id: "10000000-0000-4000-8000-000000000010",
        ledgerAccountId: sourceLedgerId,
        active: false,
      }),
    }))).toThrow("Source account is inactive")
  })

  it("rejects invalid account classifications and ambiguous ledger mappings", () => {
    expect(() => mapBankTransferPosting(input({
      fromAccount: account({
        id: "10000000-0000-4000-8000-000000000010",
        ledgerAccountId: sourceLedgerId,
        accountKind: "credit-card",
        ledgerClassification: "asset",
      }),
    }))).toThrow("credit-card account must map to an liability ledger account")

    expect(() => mapBankTransferPosting(input({
      toAccount: account({
        id: "10000000-0000-4000-8000-000000000011",
        ledgerAccountId: sourceLedgerId,
      }),
    }))).toThrow("different ledger accounts")
  })

  it("rejects malformed amounts, insufficient funds, and implicit fee accounts", () => {
    expect(() => mapBankTransferPosting(input({ amount: "18.50001" }))).toThrow(
      "at most 4 decimal places",
    )
    expect(() => mapBankTransferPosting(input({
      amount: "99.9999",
      fee: {
        amount: "0.0002",
        expenseAccount: {
          companyId: "company-1",
          ledgerAccountId: feeLedgerId,
          ledgerClassification: "expense",
          active: true,
        },
      },
    }))).toThrow("exceed the source available balance")
    expect(() => mapBankTransferPosting(input({
      fee: {
        amount: "1.0000",
        expenseAccount: {
          companyId: "company-1",
          ledgerAccountId: sourceLedgerId,
          ledgerClassification: "expense",
          active: true,
        },
      },
    }))).toThrow("separate from transfer accounts")
  })
})
