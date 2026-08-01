import { describe, expect, it } from "vitest"
import { assertBalanced } from "../../src/modules/accounting/ledger-math.js"
import { buildInvoicePosting } from "../../src/modules/sales/invoice-posting.js"

const base = {
  invoiceId: "50000000-0000-4000-8000-000000000001",
  invoiceNumber: "INV-00001",
  invoiceDate: "2026-08-01",
  currency: "USD",
  exchangeRate: "1",
  customerName: "Banaadir Trading",
  discountTotal: "0",
  taxTotal: "0",
  idempotencyKey: "invoice:50000000-0000-4000-8000-000000000001:post",
}

describe("invoice accounting", () => {
  it("debits accounts receivable and credits each revenue account", () => {
    const command = buildInvoicePosting({
      ...base,
      receivableAccountId: "10000000-0000-4000-8000-000000000002",
      total: "250.0000",
      lines: [
        {
          revenueAccountId: "10000000-0000-4000-8000-000000004010",
          description: "Consulting",
          lineTotal: "200.0000",
          discountAmount: "0",
          taxAmount: "0",
        },
        {
          revenueAccountId: "10000000-0000-4000-8000-000000004020",
          description: "Delivery service",
          lineTotal: "50.0000",
          discountAmount: "0",
          taxAmount: "0",
        },
      ],
    })

    expect(command.sourceType).toBe("invoice")
    expect(command.lines[0]).toMatchObject({ debit: "250.0000", credit: "0.0000" })
    expect(command.lines.slice(1).map((line) => line.credit)).toEqual([
      "200.0000",
      "50.0000",
    ])
    expect(() =>
      assertBalanced(command.lines as unknown as Array<Record<string, unknown>>),
    ).not.toThrow()
  })

  it("uses the tenant-configured AR system key when the customer has no override", () => {
    const command = buildInvoicePosting({
      ...base,
      customerName: "Customer",
      total: "10.0000",
      lines: [
        {
          revenueSystemAccountKey: "service_revenue",
          description: "Service",
          lineTotal: "10.0000",
          discountAmount: "0",
          taxAmount: "0",
        },
      ],
    })
    expect(command.lines[0]?.systemAccountKey).toBe("accounts_receivable")
    expect(command.lines[1]?.systemAccountKey).toBe("service_revenue")
  })

  it("posts cost of goods sold against inventory for a stocked line", () => {
    const command = buildInvoicePosting({
      ...base,
      total: "200.0000",
      lines: [
        {
          revenueSystemAccountKey: "sales_revenue",
          description: "Crate",
          lineTotal: "200.0000",
          discountAmount: "0",
          taxAmount: "0",
          cost: "120.0000",
        },
      ],
    })

    expect(command.lines.map((line) => line.systemAccountKey)).toEqual([
      "accounts_receivable",
      "sales_revenue",
      "cost_of_goods_sold",
      "inventory_asset",
    ])
    expect(() =>
      assertBalanced(command.lines as unknown as Array<Record<string, unknown>>),
    ).not.toThrow()
  })

  it("balances a discounted, taxed invoice with a separate tax credit", () => {
    const command = buildInvoicePosting({
      ...base,
      total: "94.5000",
      discountTotal: "10.0000",
      taxTotal: "4.5000",
      lines: [
        {
          revenueSystemAccountKey: "service_revenue",
          description: "Service",
          lineTotal: "100.0000",
          discountAmount: "0",
          taxAmount: "4.5000",
        },
      ],
    })

    const totals = command.lines.reduce(
      (result, line) => ({
        debit: result.debit + Number(line.debit),
        credit: result.credit + Number(line.credit),
      }),
      { debit: 0, credit: 0 },
    )
    expect(totals.debit).toBeCloseTo(totals.credit, 4)
    expect(
      command.lines.find((line) => line.systemAccountKey === "sales_discounts")?.debit,
    ).toBe("10.0000")
    expect(
      command.lines.find((line) => line.systemAccountKey === "tax_payable")?.credit,
    ).toBe("4.5000")
  })
})
