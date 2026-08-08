import { Money } from "./money.js"

export function decimalToMinor(value: unknown): bigint {
  return Money.parse(String(value ?? "0")).toScaledInteger()
}

export function minorToDecimal(value: bigint): string {
  return Money.fromScaledInteger(value).format()
}

export function assertBalanced(lines: Array<Record<string, unknown>>) {
  if (lines.length < 2) throw new Error("Journal entry must contain at least two lines")
  const totals = lines.reduce<{ debit: bigint; credit: bigint }>((result, line) => ({
    debit: result.debit + validateJournalLineAmount(line, "debit"),
    credit: result.credit + validateJournalLineAmount(line, "credit"),
  }), { debit: 0n, credit: 0n })
  if (totals.debit <= 0n || totals.debit !== totals.credit) {
    throw new Error("Journal entry must have equal non-zero debits and credits")
  }
  return totals
}

function validateJournalLineAmount(
  line: Record<string, unknown>,
  side: "debit" | "credit",
) {
  const debit = decimalToMinor(line.debit)
  const credit = decimalToMinor(line.credit)
  if (debit < 0n || credit < 0n) {
    throw new Error("Journal line debit and credit amounts cannot be negative")
  }
  if ((debit > 0n) === (credit > 0n)) {
    throw new Error("Each journal line must contain exactly one positive debit or credit")
  }
  return side === "debit" ? debit : credit
}
