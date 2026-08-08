import { describe, expect, it } from "vitest"
import { calculateInvoiceTotals } from "../../src/modules/sales/invoice-totals.js"

describe("invoice total calculator", () => {
  it("calculates scale-4 totals without floating-point arithmetic", () => {
    expect(
      calculateInvoiceTotals({
        discountType: "fixed",
        discountValue: "0.1000",
        lines: [
          {
            itemId: "item-1",
            description: "Fractional quantity",
            quantity: "3",
            unitPrice: "0.1000",
            discountAmount: "0.0500",
          },
          {
            accountId: "service-income",
            description: "Service",
            quantity: "1.2500",
            unitPrice: "8.0000",
            discountAmount: "0",
          },
        ],
      }),
    ).toEqual({
      lines: [
        expect.objectContaining({ lineTotal: "0.2500" }),
        expect.objectContaining({ lineTotal: "10.0000" }),
      ],
      subtotal: "10.3000",
      discountTotal: "0.1500",
      taxTotal: "0.0000",
      total: "10.1500",
      amountPaid: "0.0000",
      balanceDue: "10.1500",
    })
  })

  it("charges tax on the amount left after the document discount", () => {
    expect(
      calculateInvoiceTotals({
        discountType: "percentage",
        discountValue: "10",
        lines: [
          {
            itemId: "item-1",
            description: "Taxed item",
            quantity: "2",
            unitPrice: "100",
            discountAmount: "0",
            taxRate: "5",
          },
        ],
      }),
    ).toMatchObject({
      subtotal: "200.0000",
      discountTotal: "20.0000",
      // Tax applies to 180.00, not to the undiscounted 200.00.
      taxTotal: "9.0000",
      total: "189.0000",
      balanceDue: "189.0000",
    })
  })

  it("rejects discounts and paid amounts greater than the invoice", () => {
    const line = {
      itemId: "item-1",
      description: "Item",
      quantity: "1",
      unitPrice: "10",
      discountAmount: "11",
    }
    expect(() =>
      calculateInvoiceTotals({ lines: [line], discountType: "none", discountValue: "0" }),
    ).toThrow("line discount")

    expect(() =>
      calculateInvoiceTotals({
        lines: [{ ...line, discountAmount: "0" }],
        discountType: "none",
        discountValue: "0",
        amountPaid: "10.0001",
      }),
    ).toThrow("paid amount")
  })

  it("applies percentage discounts after line discounts", () => {
    expect(calculateInvoiceTotals({
      discountType: "percentage",
      discountValue: "10",
      lines: [{
        itemId: "item-1",
        description: "Discounted item",
        quantity: "1",
        unitPrice: "100",
        discountAmount: "10",
      }],
    })).toMatchObject({
      subtotal: "100.0000",
      discountTotal: "19.0000",
      total: "81.0000",
      balanceDue: "81.0000",
    })
  })

  it("uses half-away-from-zero at multiplication boundaries", () => {
    expect(calculateInvoiceTotals({
      discountType: "none",
      discountValue: "0",
      lines: [{
        itemId: "item-1",
        description: "Rounding boundary",
        quantity: "0.0001",
        unitPrice: "0.5000",
        discountAmount: "0",
      }],
    })).toMatchObject({ subtotal: "0.0001", total: "0.0001" })
  })
})
