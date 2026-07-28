import { describe, expect, it } from "vitest";
import { tableCellValue } from "../features/resources/table-cell-value";

describe("tableCellValue", () => {
  it("maps inventory columns to their real API fields", () => {
    const item = {
      sku: "RAW-001",
      name: "HDPE Resin",
      type: "inventory",
      openingQuantity: "120",
      salesPrice: "18.5",
      purchaseCost: "12.25",
    };

    expect(tableCellValue("SKU", item)).toBe("RAW-001");
    expect(tableCellValue("Item", item)).toBe("HDPE Resin");
    expect(tableCellValue("Type", item)).toBe("inventory");
    expect(tableCellValue("On hand", item)).toBe("120");
    expect(tableCellValue("Sales price", item)).toBe("$18.50");
    expect(tableCellValue("Cost price", item)).toBe("$12.25");
  });

  it("maps sales document dates, totals, and balances", () => {
    const invoice = {
      documentNumber: "INV-00125",
      invoiceDate: "2026-07-28",
      dueDate: "2026-08-27",
      total: "2400",
      balanceDue: "900",
    };

    expect(tableCellValue("Invoice", invoice)).toBe("INV-00125");
    expect(tableCellValue("Invoice date", invoice)).toBe("2026-07-28");
    expect(tableCellValue("Due date", invoice)).toBe("2026-08-27");
    expect(tableCellValue("Amount", invoice)).toBe("$2,400.00");
    expect(tableCellValue("Balance due", invoice)).toBe("$900.00");
  });

  it("uses resolved customer and vendor names instead of database ids", () => {
    const transaction = {
      customerId: "bd2246f5-2355-4d1e-aba6-43e645845905",
      vendorId: "53000000-0000-4000-8000-000000000001",
    };

    expect(
      tableCellValue("Customer", transaction, {
        customer: "Banaadir Trading Co.",
      }),
    ).toBe("Banaadir Trading Co.");
    expect(
      tableCellValue("Vendor", transaction, {
        vendor: "SomPolymer Supplies",
      }),
    ).toBe("SomPolymer Supplies");
  });

  it("maps customer and account master columns", () => {
    expect(
      tableCellValue("Company", {
        companyName: "Banaadir Trading Co.",
      }),
    ).toBe("Banaadir Trading Co.");
    expect(
      tableCellValue("Account number", {
        accountNumber: "1200",
      }),
    ).toBe("1200");
    expect(
      tableCellValue("Account name", {
        accountName: "Inventory Asset",
      }),
    ).toBe("Inventory Asset");
  });
});
