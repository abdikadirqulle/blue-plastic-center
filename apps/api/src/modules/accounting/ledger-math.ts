const scale = 10_000n

export function decimalToMinor(value: unknown): bigint {
  const text = String(value ?? "0")
  const negative = text.startsWith("-")
  const normalized = negative ? text.slice(1) : text
  const [whole = "0", fraction = ""] = normalized.split(".")
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) throw new Error("Invalid decimal amount")
  if (fraction.length > 4) throw new Error("Accounting amounts support at most 4 decimal places")
  const result = BigInt(whole) * scale + BigInt(fraction.padEnd(4, "0"))
  return negative ? -result : result
}

export function minorToDecimal(value: bigint): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  return `${negative ? "-" : ""}${absolute / scale}.${String(absolute % scale).padStart(4, "0")}`
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
