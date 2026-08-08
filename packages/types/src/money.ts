const MONEY_SCALE = 4
const MONEY_FACTOR = 10n ** BigInt(MONEY_SCALE)

export type MoneyRoundingMode = "half-away-from-zero"

export interface ParseMoneyOptions {
  roundingMode?: MoneyRoundingMode
}

function divideRounded(
  numerator: bigint,
  denominator: bigint,
  roundingMode: MoneyRoundingMode,
) {
  if (denominator === 0n) throw new Error("Cannot divide a financial amount by zero")
  const negative = (numerator < 0n) !== (denominator < 0n)
  const absoluteNumerator = numerator < 0n ? -numerator : numerator
  const absoluteDenominator = denominator < 0n ? -denominator : denominator
  let quotient = absoluteNumerator / absoluteDenominator
  const remainder = absoluteNumerator % absoluteDenominator
  if (roundingMode === "half-away-from-zero" && remainder * 2n >= absoluteDenominator) {
    quotient += 1n
  }
  return negative ? -quotient : quotient
}

/** Exact fixed-point financial amount with four decimal places. */
export class ExactMoney {
  private constructor(private readonly scaled: bigint) {}

  static parse(value: string, options: ParseMoneyOptions = {}) {
    if (!/^-?\d+(?:\.\d*)?$/.test(value)) throw new Error("Invalid decimal amount")

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
    ) absolute += 1n

    return new ExactMoney(negative ? -absolute : absolute)
  }

  static fromScaledInteger(value: bigint) {
    return new ExactMoney(value)
  }

  add(other: ExactMoney) {
    return new ExactMoney(this.scaled + other.scaled)
  }

  subtract(other: ExactMoney) {
    return new ExactMoney(this.scaled - other.scaled)
  }

  multiply(other: ExactMoney, roundingMode: MoneyRoundingMode) {
    return new ExactMoney(divideRounded(this.scaled * other.scaled, MONEY_FACTOR, roundingMode))
  }

  multiplyDivide(
    multiplier: ExactMoney,
    divisor: ExactMoney,
    roundingMode: MoneyRoundingMode,
  ) {
    return new ExactMoney(divideRounded(
      this.scaled * multiplier.scaled,
      divisor.scaled,
      roundingMode,
    ))
  }

  compare(other: ExactMoney) {
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

export const parseMoney = (value: string, options?: ParseMoneyOptions) =>
  ExactMoney.parse(value, options)
export const formatMoney = (value: ExactMoney) => value.format()
export const addMoney = (left: ExactMoney, right: ExactMoney) => left.add(right)
export const subtractMoney = (left: ExactMoney, right: ExactMoney) => left.subtract(right)
export const multiplyMoney = (
  left: ExactMoney,
  right: ExactMoney,
  roundingMode: MoneyRoundingMode,
) => left.multiply(right, roundingMode)
export const multiplyDivideMoney = (
  value: ExactMoney,
  multiplier: ExactMoney,
  divisor: ExactMoney,
  roundingMode: MoneyRoundingMode,
) => value.multiplyDivide(multiplier, divisor, roundingMode)
export const compareMoney = (left: ExactMoney, right: ExactMoney) => left.compare(right)
export const isZeroMoney = (value: ExactMoney) => value.isZero()
