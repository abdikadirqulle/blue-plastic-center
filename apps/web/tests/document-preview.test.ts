import { describe, expect, it } from "vitest";
import { buildDocumentPreview } from "../features/sales/domain/document-preview";

const resolveReference = (value: unknown) =>
  value === "customer-1" ? "Banaadir Trading Co." : String(value);

describe("buildDocumentPreview", () => {
  it("prints the stored document rather than an example", () => {
    const preview = buildDocumentPreview(
      {
        customerId: "customer-1",
        invoiceDate: "2026-07-28",
        dueDate: "2026-08-27",
        currency: "USD",
        reference: "PO-9912",
        lines: [
          {
            description: "Tamper-proof cap",
            quantity: "5000",
            unitPrice: "0.18",
            lineTotal: "900.0000",
          },
        ],
        subtotal: "900.0000",
        total: "900.0000",
        balanceDue: "400.0000",
      },
      {
        documentNumber: "INV-00125",
        documentTitle: "Invoice",
        resolveReference,
      },
    );

    expect(preview.partyName).toBe("Banaadir Trading Co.");
    expect(preview.partyLabel).toBe("Bill to");
    expect(preview.date).toBe("2026-07-28");
    expect(preview.dueDate).toBe("2026-08-27");
    expect(preview.reference).toBe("PO-9912");
    expect(preview.lines).toEqual([
      {
        description: "Tamper-proof cap",
        quantity: "5000",
        rate: "0.18",
        amount: "900.00",
      },
    ]);
    expect(preview.totals).toEqual([
      { label: "Subtotal", value: "900.00" },
      { label: "Total", value: "900.00", strong: true },
      { label: "Balance due", value: "400.00", strong: true },
    ]);
  });

  it("leaves an empty document empty instead of inventing lines or totals", () => {
    const preview = buildDocumentPreview(
      { currency: "USD" },
      {
        documentNumber: "INV-00126",
        documentTitle: "Invoice",
        resolveReference,
      },
    );

    expect(preview.partyName).toBe("—");
    expect(preview.lines).toEqual([]);
    expect(preview.totals).toEqual([]);
    expect(preview.date).toBeUndefined();
  });

  it("labels a purchase document by its vendor", () => {
    const preview = buildDocumentPreview(
      { vendorName: "SomPolymer Supplies", billDate: "2026-07-12" },
      { documentNumber: "BILL-1", documentTitle: "Bill", resolveReference },
    );

    expect(preview.partyLabel).toBe("Vendor");
    expect(preview.partyName).toBe("SomPolymer Supplies");
    expect(preview.date).toBe("2026-07-12");
  });
});
