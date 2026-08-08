import { describe, expect, it } from "vitest"
import { calculateInvoiceSettlement } from "../../src/modules/sales/invoice-settlement.js"

describe("canonical invoice settlement", () => {
  it("keeps a draft invoice outside AR settlement", () => {
    expect(calculateInvoiceSettlement({
      invoiceStatus: "draft", total: "100.0000", postedAllocationTotal: "90.0000",
    })).toEqual({ amountPaid: "0.0000", balanceDue: "100.0000", status: "draft" })
  })

  it("projects unpaid, partial, aggregate full, and exact scale-4 settlement", () => {
    expect(calculateInvoiceSettlement({
      invoiceStatus: "open", total: "100", postedAllocationTotal: "0",
    })).toEqual({ amountPaid: "0.0000", balanceDue: "100.0000", status: "open" })
    expect(calculateInvoiceSettlement({
      invoiceStatus: "open", total: "100", postedAllocationTotal: "40.1234",
    })).toEqual({ amountPaid: "40.1234", balanceDue: "59.8766", status: "partially_paid" })
    expect(calculateInvoiceSettlement({
      invoiceStatus: "partially_paid", total: "100", postedAllocationTotal: "100",
    })).toEqual({ amountPaid: "100.0000", balanceDue: "0.0000", status: "paid" })
  })

  it("rejects facts that would produce a negative balance", () => {
    expect(() => calculateInvoiceSettlement({
      invoiceStatus: "open", total: "100", postedAllocationTotal: "100.0001",
    })).toThrow("Posted payment allocations exceed the invoice total")
  })
})
