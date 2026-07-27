const scale = 10_000n

export function decimalToMinor(value: unknown): bigint {
  const text = String(value ?? "0")
  const negative = text.startsWith("-")
  const normalized = negative ? text.slice(1) : text
  const [whole = "0", fraction = ""] = normalized.split(".")
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fraction)) throw new Error("Invalid decimal amount")
  const result = BigInt(whole) * scale + BigInt(fraction.padEnd(4, "0").slice(0, 4))
  return negative ? -result : result
}

export function minorToDecimal(value: bigint): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  return `${negative ? "-" : ""}${absolute / scale}.${String(absolute % scale).padStart(4, "0")}`
}

export function assertBalanced(lines: Array<Record<string, unknown>>) {
  const totals = lines.reduce<{ debit: bigint; credit: bigint }>((result, line) => ({
    debit: result.debit + decimalToMinor(line.debit),
    credit: result.credit + decimalToMinor(line.credit),
  }), { debit: 0n, credit: 0n })
  if (totals.debit <= 0n || totals.debit !== totals.credit) {
    throw new Error("Journal entry must have equal non-zero debits and credits")
  }
  return totals
}
