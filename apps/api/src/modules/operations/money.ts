import { addMoney, formatMoney, multiplyMoney, parseMoney } from "@blue-plastic/types"

/** Quantity times unit price, in the same exact arithmetic a posting uses. */
export function lineAmount(line: Record<string, unknown>): string {
  const quantity = parseMoney(String(line.quantity ?? "1"))
  const unitPrice = parseMoney(String(line.unitPrice ?? line.rate ?? "0"))
  return formatMoney(multiplyMoney(quantity, unitPrice, "half-away-from-zero"))
}

export function sumLineAmounts(lines: Array<Record<string, unknown>>): string {
  const total = lines.reduce(
    (sum, line) => addMoney(sum, parseMoney(lineAmount(line))),
    parseMoney("0"),
  )
  return formatMoney(total)
}
