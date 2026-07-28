import { describe, expect, it } from "vitest";
import {
  hydrateResourceFormValues,
  normalizeResourceData,
  resourceFieldValue,
} from "../features/resources/resource-field-mapping";

describe("resource field mapping", () => {
  it("normalizes UI aliases without removing original form values", () => {
    const data = normalizeResourceData({
      customer: "customer-uuid",
      poNumber: "PO-4482",
      class: "Wholesale",
      terms: "Net 30",
    });

    expect(data.customerId).toBe("customer-uuid");
    expect(data.customerPurchaseOrder).toBe("PO-4482");
    expect(data.class).toBe("Wholesale");
    expect(data.terms).toBe("Net 30");
  });

  it("loads canonical backend fields into their configured form controls", () => {
    const data = {
      customerId: "customer-uuid",
      customerPurchaseOrder: "PO-4482",
      incomeAccountId: "income-account-uuid",
    };

    expect(resourceFieldValue("customer", data)).toBe("customer-uuid");
    expect(resourceFieldValue("poNumber", data)).toBe("PO-4482");
    expect(resourceFieldValue("incomeAccountId", data)).toBe(
      "income-account-uuid",
    );
  });

  it("hydrates edit forms with saved values while preserving defaults for absent fields", () => {
    expect(
      hydrateResourceFormValues(
        ["customer", "poNumber", "currency", "memo"],
        {
          customerId: "customer-uuid",
          customerPurchaseOrder: "PO-4482",
          memo: "Deliver before noon",
        },
        { currency: "USD" },
      ),
    ).toEqual({
      customer: "customer-uuid",
      poNumber: "PO-4482",
      currency: "USD",
      memo: "Deliver before noon",
    });
  });
});
