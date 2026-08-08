import {
  addMoney,
  compareMoney,
  formatMoney,
  invoiceCreateDataSchema,
  isZeroMoney,
  multiplyDivideMoney,
  multiplyMoney,
  parseMoney,
  subtractMoney,
  type InvoiceCreateData,
  type InvoiceLineInput,
  type InvoiceTotals,
} from "@blue-plastic/types"

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
  let subtotal = parseMoney("0")
  let lineDiscountTotal = parseMoney("0")

  const netLines = parsed.lines.map((line) => {
    const gross = multiplyMoney(
      parseMoney(line.quantity),
      parseMoney(line.unitPrice),
      "half-away-from-zero",
    )
    const discount = parseMoney(line.discountAmount)
    if (compareMoney(discount, gross) > 0)
      throw new Error("Invoice line discount cannot exceed its gross amount")
    subtotal = addMoney(subtotal, gross)
    lineDiscountTotal = addMoney(lineDiscountTotal, discount)
    return { line, net: subtractMoney(gross, discount) }
  })

  const discountValue = parseMoney(parsed.discountValue)
  const oneHundred = parseMoney("100")
  if (parsed.discountType === "percentage" && compareMoney(discountValue, oneHundred) > 0)
    throw new Error("Invoice discount percentage cannot exceed 100")
  const afterLineDiscounts = subtractMoney(subtotal, lineDiscountTotal)
  const documentDiscount =
    parsed.discountType === "fixed"
      ? discountValue
      : parsed.discountType === "percentage"
        ? multiplyDivideMoney(
          afterLineDiscounts,
          discountValue,
          oneHundred,
          "half-away-from-zero",
        )
        : parseMoney("0")
  if (compareMoney(documentDiscount, afterLineDiscounts) > 0)
    throw new Error("Invoice discounts cannot exceed the subtotal")
  const discountTotal = addMoney(lineDiscountTotal, documentDiscount)
  if (compareMoney(discountTotal, subtotal) > 0)
    throw new Error("Invoice discounts cannot exceed the subtotal")

  let allocatedDiscount = parseMoney("0")
  let taxTotal = parseMoney("0")
  const lines = netLines.map(({ line, net }, index) => {
    const isLast = index === netLines.length - 1
    const share = isLast
      ? subtractMoney(documentDiscount, allocatedDiscount)
      : isZeroMoney(afterLineDiscounts)
        ? parseMoney("0")
        : multiplyDivideMoney(
          documentDiscount,
          net,
          afterLineDiscounts,
          "half-away-from-zero",
        )
    allocatedDiscount = addMoney(allocatedDiscount, share)
    const taxable = subtractMoney(net, share)
    const taxAmount = multiplyDivideMoney(
      taxable,
      parseMoney(line.taxRate),
      oneHundred,
      "half-away-from-zero",
    )
    taxTotal = addMoney(taxTotal, taxAmount)
    return { ...line, lineTotal: formatMoney(net), taxAmount: formatMoney(taxAmount) }
  })

  const total = addMoney(subtractMoney(subtotal, discountTotal), taxTotal)
  const amountPaid = parseMoney(input.amountPaid ?? "0")
  if (compareMoney(amountPaid, total) > 0)
    throw new Error("Invoice paid amount cannot exceed the total")

  return {
    lines,
    subtotal: formatMoney(subtotal),
    discountTotal: formatMoney(discountTotal),
    taxTotal: formatMoney(taxTotal),
    total: formatMoney(total),
    amountPaid: formatMoney(amountPaid),
    balanceDue: formatMoney(subtractMoney(total, amountPaid)),
  }
}
