import { describe, expect, it } from "vitest"
import { buildArReconciliationResult } from "../../src/modules/sales/ar-reconciliation.js"

describe("AR reconciliation result", () => {
  it("reports reconciled when subledger equals GL", () => {
    expect(buildArReconciliationResult({
      companyId: "company-a",
      subledgerBalance: "1250.5000",
      glBalance: "1250.5",
    })).toEqual({
      companyId: "company-a",
      subledgerBalance: "1250.5000",
      glBalance: "1250.5000",
      difference: "0.0000",
      isReconciled: true,
    })
  })

  it("exposes the exact difference when the sides diverge", () => {
    expect(buildArReconciliationResult({
      companyId: "company-a",
      subledgerBalance: "1000.0000",
      glBalance: "925.2500",
    })).toEqual({
      companyId: "company-a",
      subledgerBalance: "1000.0000",
      glBalance: "925.2500",
      difference: "74.7500",
      isReconciled: false,
    })
  })
})
