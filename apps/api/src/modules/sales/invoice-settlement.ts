import { compareMoney, formatMoney, parseMoney, subtractMoney } from "../accounting/money.js"
import { validation } from "../../platform/errors.js"

export interface InvoiceSettlement {
  amountPaid: string
  balanceDue: string
  status: string
}

/** Canonical invoice settlement projection from posted relational allocations. */
export function calculateInvoiceSettlement(input: {
  invoiceStatus: string
  total: string
  postedAllocationTotal: string
}): InvoiceSettlement {
  const total = parseMoney(input.total)
  const amountPaid = input.invoiceStatus === "draft"
    ? parseMoney("0")
    : parseMoney(input.postedAllocationTotal)
  if (compareMoney(amountPaid, total) > 0)
    throw validation("Posted payment allocations exceed the invoice total")
  const balanceDue = subtractMoney(total, amountPaid)
  const status = input.invoiceStatus === "draft" || input.invoiceStatus === "voided"
    ? input.invoiceStatus
    : compareMoney(balanceDue, parseMoney("0")) === 0
      ? "paid"
      : compareMoney(amountPaid, parseMoney("0")) > 0
        ? "partially_paid"
        : input.invoiceStatus === "overdue" ? "overdue" : "open"
  return {
    amountPaid: formatMoney(amountPaid),
    balanceDue: input.invoiceStatus === "voided" ? "0.0000" : formatMoney(balanceDue),
    status,
  }
}
