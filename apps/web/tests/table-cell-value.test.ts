import { describe, expect, it } from "vitest";
import {
  isNumericColumn,
  tableCellValue,
} from "../features/resources/table-cell-value";

describe("tableCellValue", () => {
  it("maps inventory columns to their real API fields", () => {
    const item = {
      sku: "RAW-001",
      name: "HDPE Resin",
      type: "inventory",
      quantityOnHand: "120.0000",
      inventoryValue: "1470.0000",
      salesPrice: "18.5",
      purchaseCost: "12.25",
    };

    expect(tableCellValue("SKU", item)).toBe("RAW-001");
    expect(tableCellValue("Item", item)).toBe("HDPE Resin");
    expect(tableCellValue("Type", item)).toBe("inventory");
    expect(tableCellValue("On hand", item)).toBe("120.00");
    expect(tableCellValue("Value", item)).toBe("1,470.00");
    expect(tableCellValue("Sales price", item)).toBe("18.50");
    expect(tableCellValue("Cost price", item)).toBe("12.25");
  });

  it("never shows a form figure where a calculated one belongs", () => {
    const item = { name: "HDPE Resin", openingQuantity: "120" };
    const customer = { displayName: "Banaadir", openingBalance: "4500" };

    expect(tableCellValue("On hand", item)).toBe("—");
    expect(tableCellValue("Open balance", customer)).toBe("—");
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
    expect(tableCellValue("Amount", invoice)).toBe("2,400.00");
    expect(tableCellValue("Balance due", invoice)).toBe("900.00");
  });

  it("reads the balances and names the API calculated", () => {
    const customer = {
      displayName: "Banaadir Trading Co.",
      openBalance: "1500.0000",
      overdueBalance: "500.0000",
    };
    const account = {
      accountNumber: "1100",
      accountName: "Accounts Receivable",
      accountType: "asset",
      balance: "174685.0000",
    };
    const journal = { journalNumber: "JE-120", reference: "110022" };

    expect(tableCellValue("Customer", customer)).toBe("Banaadir Trading Co.");
    expect(tableCellValue("Open balance", customer)).toBe("1,500.00");
    expect(tableCellValue("Overdue", customer)).toBe("500.00");
    expect(tableCellValue("Account number", account)).toBe("1100");
    expect(tableCellValue("Balance", account)).toBe("174,685.00");
    expect(tableCellValue("Journal", journal)).toBe("JE-120");
    expect(tableCellValue("Reference", journal)).toBe("110022");
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

  it("right-aligns figure columns and leaves text columns alone", () => {
    for (const column of [
      "Amount",
      "Balance due",
      "Open balance",
      "Overdue",
      "On hand",
      "Value",
      "Debit",
      "Credit",
      "Cost price",
    ])
      expect(isNumericColumn(column)).toBe(true);

    for (const column of ["Customer", "Invoice date", "Status", "Account name"])
      expect(isNumericColumn(column)).toBe(false);
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

  it("uses resolved bank account names and hides junk sku values", () => {
    expect(
      tableCellValue("Bank account", {
        bankAccount: "10000000-0000-4000-8000-000000006000",
        bankAccountName: "Operating Cash",
      }),
    ).toBe("Operating Cash");
    expect(
      tableCellValue("SKU", {
        sku: "undefined",
        name: "iphone 15 pro max",
      }),
    ).toBe("—");
  });
});
