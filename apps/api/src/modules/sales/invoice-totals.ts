import {
  invoiceCreateDataSchema,
  type InvoiceCreateData,
  type InvoiceLineInput,
  type InvoiceTotals,
} from "@blue-plastic/types"

const SCALE = 10_000n

function parseDecimal(value: string) {
  const [whole = "0", fraction = ""] = value.split(".")
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0"))
}

function decimal(value: bigint) {
  return `${value / SCALE}.${String(value % SCALE).padStart(4, "0")}`
}

function multiply(left: bigint, right: bigint) {
  return (left * right + SCALE / 2n) / SCALE
}

export interface CalculatedInvoiceLine extends InvoiceLineInput {
  /** Net of the line discount and excluding tax. Revenue is credited with this. */
  lineTotal: string
  taxAmount: string
}

export interface CalculatedInvoice extends InvoiceTotals {
  lines: CalculatedInvoiceLine[]
}

/**
 * Calculates authoritative invoice totals using fixed-point, scale-4 math.
 *
 * A document discount is allocated across lines in proportion to their net
 * amount so tax is charged on what the customer actually owes. The final line
 * absorbs the allocation remainder, which keeps the sum exact.
 */
export function calculateInvoiceTotals(
  input: Pick<InvoiceCreateData, "lines" | "discountType" | "discountValue"> & {
    amountPaid?: string
  },
): CalculatedInvoice {
  const parsed = invoiceCreateDataSchema
    .pick({ lines: true, discountType: true, discountValue: true })
    .parse(input)
  let subtotal = 0n
  let lineDiscountTotal = 0n

  const netLines = parsed.lines.map((line) => {
    const gross = multiply(parseDecimal(line.quantity), parseDecimal(line.unitPrice))
    const discount = parseDecimal(line.discountAmount)
    if (discount > gross)
      throw new Error("Invoice line discount cannot exceed its gross amount")
    subtotal += gross
    lineDiscountTotal += discount
    return { line, net: gross - discount }
  })

  const discountValue = parseDecimal(parsed.discountValue)
  if (parsed.discountType === "percentage" && discountValue > 100n * SCALE)
    throw new Error("Invoice discount percentage cannot exceed 100")
  const afterLineDiscounts = subtotal - lineDiscountTotal
  const documentDiscount =
    parsed.discountType === "fixed"
      ? discountValue
      : parsed.discountType === "percentage"
        ? multiply(afterLineDiscounts, discountValue) / 100n
        : 0n
  if (documentDiscount > afterLineDiscounts)
    throw new Error("Invoice discounts cannot exceed the subtotal")
  const discountTotal = lineDiscountTotal + documentDiscount
  if (discountTotal > subtotal)
    throw new Error("Invoice discounts cannot exceed the subtotal")

  let allocatedDiscount = 0n
  let taxTotal = 0n
  const lines = netLines.map(({ line, net }, index) => {
    const isLast = index === netLines.length - 1
    const share = isLast
      ? documentDiscount - allocatedDiscount
      : afterLineDiscounts === 0n
        ? 0n
        : (documentDiscount * net) / afterLineDiscounts
    allocatedDiscount += share
    const taxable = net - share
    const taxAmount = multiply(taxable, parseDecimal(line.taxRate)) / 100n
    taxTotal += taxAmount
    return { ...line, lineTotal: decimal(net), taxAmount: decimal(taxAmount) }
  })

  const total = subtotal - discountTotal + taxTotal
  const amountPaid = parseDecimal(input.amountPaid ?? "0")
  if (amountPaid > total)
    throw new Error("Invoice paid amount cannot exceed the total")

  return {
    lines,
    subtotal: decimal(subtotal),
    discountTotal: decimal(discountTotal),
    taxTotal: decimal(taxTotal),
    total: decimal(total),
    amountPaid: decimal(amountPaid),
    balanceDue: decimal(total - amountPaid),
  }
}
