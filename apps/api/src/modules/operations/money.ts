const scale = 10_000n

function toScaled(value: string): bigint {
  const negative = value.startsWith("-")
  const normalized = negative ? value.slice(1) : value
  const [whole = "0", fraction = ""] = normalized.split(".")
  const scaled = BigInt(whole) * scale + BigInt(fraction.padEnd(4, "0").slice(0, 4))
  return negative ? -scaled : scaled
}

function fromScaled(value: bigint): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  const whole = absolute / scale
  const fraction = String(absolute % scale).padStart(4, "0")
  return `${negative ? "-" : ""}${whole}.${fraction}`
}

/** Quantity times unit price, in the same exact arithmetic a posting uses. */
export function lineAmount(line: Record<string, unknown>): string {
  const quantity = toScaled(String(line.quantity ?? "1"))
  const unitPrice = toScaled(String(line.unitPrice ?? line.rate ?? "0"))
  return fromScaled((quantity * unitPrice) / scale)
}

export function sumLineAmounts(lines: Array<Record<string, unknown>>): string {
  const total = lines.reduce(
    (sum, line) => sum + toScaled(lineAmount(line)),
    0n,
  )
  return fromScaled(total)
}
