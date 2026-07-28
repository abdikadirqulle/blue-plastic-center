import { describe, expect, it } from "vitest"
import { assertBalanced, decimalToMinor, minorToDecimal } from "../../src/modules/accounting/ledger-math.js"
import { sumLineAmounts } from "../../src/modules/operations/money.js"

describe("exact financial arithmetic", () => {
  it.each([
    ["0", 0n],
    ["12.34", 123400n],
    ["-7.0001", -70001n],
    ["999.99999", 9_999_999n],
  ])("converts %s to four-decimal minor units", (input, expected) => {
    expect(decimalToMinor(input)).toBe(expected)
  })

  it("round-trips minor units without floating point arithmetic", () => {
    expect(minorToDecimal(decimalToMinor("123456.7891"))).toBe("123456.7891")
  })

  it("sums line quantities and prices exactly", () => {
    expect(sumLineAmounts([
      { quantity: "2.5", unitPrice: "10.1234" },
      { quantity: "3", unitPrice: "0.1000" },
    ])).toBe("25.6085")
  })

  it("accepts balanced journals and rejects invalid journals", () => {
    expect(assertBalanced([
      { debit: "125.5000", credit: "0" },
      { debit: "0", credit: "125.5000" },
    ])).toEqual({ debit: 1_255_000n, credit: 1_255_000n })

    expect(() => assertBalanced([
      { debit: "10", credit: "0" },
      { debit: "0", credit: "9" },
    ])).toThrow("equal non-zero debits and credits")
  })
})
