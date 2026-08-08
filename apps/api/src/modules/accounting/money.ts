const MONEY_SCALE = 4
const MONEY_FACTOR = 10n ** BigInt(MONEY_SCALE)

export type MoneyRoundingMode = "half-away-from-zero"

export interface ParseMoneyOptions {
  roundingMode?: MoneyRoundingMode
}

/**
 * Opaque fixed-point money value. Financial values enter and leave this module
 * as decimal strings; the scaled integer bridge exists only for legacy ledger
 * compatibility while it keeps returning bigint totals.
 */
export class Money {
  private constructor(private readonly scaled: bigint) {}

  static parse(value: string, options: ParseMoneyOptions = {}) {
    if (!/^-?\d+(?:\.\d*)?$/.test(value)) {
      throw new Error("Invalid decimal amount")
    }

    const negative = value.startsWith("-")
    const unsigned = negative ? value.slice(1) : value
    const [whole, fraction = ""] = unsigned.split(".")

    if (fraction.length > MONEY_SCALE && !options.roundingMode) {
      throw new Error("Accounting amounts support at most 4 decimal places")
    }

    const retained = fraction.slice(0, MONEY_SCALE).padEnd(MONEY_SCALE, "0")
    let absolute = BigInt(whole) * MONEY_FACTOR + BigInt(retained)

    if (
      fraction.length > MONEY_SCALE &&
      options.roundingMode === "half-away-from-zero" &&
      fraction[MONEY_SCALE] >= "5"
    ) {
      absolute += 1n
    }

    return new Money(negative ? -absolute : absolute)
  }

  static fromScaledInteger(value: bigint) {
    return new Money(value)
  }

  add(other: Money) {
    return new Money(this.scaled + other.scaled)
  }

  subtract(other: Money) {
    return new Money(this.scaled - other.scaled)
  }

  compare(other: Money) {
    return this.scaled < other.scaled ? -1 : this.scaled > other.scaled ? 1 : 0
  }

  isZero() {
    return this.scaled === 0n
  }

  format() {
    const negative = this.scaled < 0n
    const absolute = negative ? -this.scaled : this.scaled
    return `${negative ? "-" : ""}${absolute / MONEY_FACTOR}.${String(
      absolute % MONEY_FACTOR,
    ).padStart(MONEY_SCALE, "0")}`
  }

  /** Compatibility boundary for ledger APIs that already expose bigint. */
  toScaledInteger() {
    return this.scaled
  }
}

export function parseMoney(value: string, options?: ParseMoneyOptions) {
  return Money.parse(value, options)
}

export function formatMoney(value: Money) {
  return value.format()
}

export function addMoney(left: Money, right: Money) {
  return left.add(right)
}

export function subtractMoney(left: Money, right: Money) {
  return left.subtract(right)
}

export function compareMoney(left: Money, right: Money) {
  return left.compare(right)
}

export function isZeroMoney(value: Money) {
  return value.isZero()
}
