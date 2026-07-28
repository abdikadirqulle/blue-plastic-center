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
});
