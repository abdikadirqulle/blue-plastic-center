import { describe, expect, it } from "vitest"
import { prepareSameCurrencyFunctionalAmounts } from "../../src/modules/accounting/functional-currency.js"

const balancedLines = [
  { accountId: "receivable", debit: "125.2500", credit: "0.0000" },
  { accountId: "revenue", debit: "0.0000", credit: "125.2500" },
]

describe("functional currency posting foundation", () => {
  it("preserves exact same-currency amounts in both representations", () => {
    const lines = prepareSameCurrencyFunctionalAmounts("USD", "USD", balancedLines)
    expect(lines).toEqual([
      { ...balancedLines[0], functionalDebit: "125.2500", functionalCredit: "0.0000" },
      { ...balancedLines[1], functionalDebit: "0.0000", functionalCredit: "125.2500" },
    ])
  })

  it("rejects a foreign-currency posting rather than guessing conversion", () => {
    expect(() => prepareSameCurrencyFunctionalAmounts("EUR", "USD", balancedLines))
      .toThrow("Foreign-currency GL conversion is not enabled")
  })

  it("enforces the functional journal balance", () => {
    expect(() => prepareSameCurrencyFunctionalAmounts("USD", "USD", [
      balancedLines[0],
      { ...balancedLines[1], credit: "125.2400" },
    ])).toThrow("equal non-zero debits and credits")
  })

  it("preserves reversal amounts exactly on their opposite sides", () => {
    const reversal = balancedLines.map((line) => ({
      accountId: line.accountId,
      debit: line.credit,
      credit: line.debit,
    }))
    const lines = prepareSameCurrencyFunctionalAmounts("USD", "USD", reversal)
    expect(lines.map(({ functionalDebit, functionalCredit }) => ({
      functionalDebit,
      functionalCredit,
    }))).toEqual([
      { functionalDebit: "0.0000", functionalCredit: "125.2500" },
      { functionalDebit: "125.2500", functionalCredit: "0.0000" },
    ])
  })
})
