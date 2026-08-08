import {
  formatMoney,
  multiplyDivideMoney,
  multiplyMoney,
  parseMoney,
} from "../src/money.js"
import { describe, expect, it } from "vitest"

describe("shared canonical money", () => {
  it.each([
    ["0.0001", "0.5000", "0.0001"],
    ["-0.0001", "0.5000", "-0.0001"],
    ["0.0001", "0.4999", "0.0000"],
    ["-0.0001", "0.4999", "0.0000"],
  ])("multiplies %s by %s with explicit half-away rounding", (left, right, expected) => {
    expect(formatMoney(multiplyMoney(
      parseMoney(left),
      parseMoney(right),
      "half-away-from-zero",
    ))).toBe(expected)
  })

  it("performs exact multiply/divide with signed half-away rounding", () => {
    expect(formatMoney(multiplyDivideMoney(
      parseMoney("-0.0001"),
      parseMoney("1"),
      parseMoney("2"),
      "half-away-from-zero",
    ))).toBe("-0.0001")
  })

  it("rejects division by zero", () => {
    expect(() => multiplyDivideMoney(
      parseMoney("1"),
      parseMoney("1"),
      parseMoney("0"),
      "half-away-from-zero",
    )).toThrow("divide a financial amount by zero")
  })
})
