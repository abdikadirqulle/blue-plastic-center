import { describe, expect, it } from "vitest"
import { assertBalanced, decimalToMinor, minorToDecimal } from "../../src/modules/accounting/ledger-math.js"
import {
  addMoney,
  compareMoney,
  formatMoney,
  isZeroMoney,
  parseMoney,
  subtractMoney,
} from "../../src/modules/accounting/money.js"
import { sumLineAmounts } from "../../src/modules/operations/money.js"

describe("canonical money", () => {
  it.each([
    ["0", "0.0000"],
    ["7", "7.0000"],
    ["7.1", "7.1000"],
    ["7.12", "7.1200"],
    ["7.123", "7.1230"],
    ["7.1234", "7.1234"],
    ["-7.1234", "-7.1234"],
  ])("parses and formats %s exactly", (input, expected) => {
    expect(formatMoney(parseMoney(input))).toBe(expected)
  })

  it.each(["", " ", "+1", ".5", "1.2.3", "1e2", "NaN", "--1"])(
    "rejects malformed input %j",
    (input) => expect(() => parseMoney(input)).toThrow("Invalid decimal amount"),
  )

  it("rejects excess precision unless rounding is explicitly requested", () => {
    expect(() => parseMoney("1.23450")).toThrow("at most 4 decimal places")
    expect(formatMoney(parseMoney("1.23449", {
      roundingMode: "half-away-from-zero",
    }))).toBe("1.2345")
  })

  it.each([
    ["1.23445", "1.2345"],
    ["-1.23445", "-1.2345"],
    ["1.23444", "1.2344"],
    ["-1.23444", "-1.2344"],
  ])("rounds %s using half-away-from-zero", (input, expected) => {
    expect(formatMoney(parseMoney(input, {
      roundingMode: "half-away-from-zero",
    }))).toBe(expected)
  })

  it("adds, subtracts, compares, and checks zero exactly", () => {
    const left = parseMoney("10.1001")
    const right = parseMoney("2.0002")
    expect(formatMoney(addMoney(left, right))).toBe("12.1003")
    expect(formatMoney(subtractMoney(left, right))).toBe("8.0999")
    expect(compareMoney(left, right)).toBe(1)
    expect(compareMoney(right, left)).toBe(-1)
    expect(compareMoney(left, left)).toBe(0)
    expect(isZeroMoney(subtractMoney(left, left))).toBe(true)
  })
})

describe("exact financial arithmetic", () => {
  it.each([
    ["0", 0n],
    ["12.34", 123400n],
    ["-7.0001", -70001n],
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

    expect(() => assertBalanced([
      { debit: "0", credit: "0" },
      { debit: "0", credit: "0" },
    ])).toThrow("exactly one positive")
  })

  it.each([
    [[{ debit: "10", credit: "1" }, { debit: "0", credit: "9" }], "exactly one positive"],
    [[{ debit: "-10", credit: "0" }, { debit: "0", credit: "-10" }], "cannot be negative"],
    [[{ debit: "10.00001", credit: "0" }, { debit: "0", credit: "10.00001" }], "at most 4 decimal places"],
    [[{ debit: "0", credit: "0" }, { debit: "0", credit: "0" }], "exactly one positive"],
  ])("rejects unsafe journal lines", (lines, message) => {
    expect(() => assertBalanced(lines)).toThrow(message)
  })
})
