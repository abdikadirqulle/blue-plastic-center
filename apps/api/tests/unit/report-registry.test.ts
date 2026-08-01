import { describe, expect, it } from "vitest"
import {
  getReportDefinition,
  reportRegistry,
} from "../../src/modules/reports/report-registry.js"

describe("API report registry", () => {
  it("assigns every available report an explicit execution strategy", () => {
    for (const definition of Object.values(reportRegistry)) {
      if (definition.status === "available") {
        expect([
          "ledger-summary",
          "audit",
          "sales",
          "operational",
        ]).toContain(definition.strategy)
      }
    }
  })

  it("refuses to represent General Ledger with Trial Balance aggregates", () => {
    expect(getReportDefinition("general-ledger")).toMatchObject({
      status: "unsupported",
    })
  })

  it("does not resolve unknown kinds", () => {
    expect(getReportDefinition("payroll-summary")).toBeUndefined()
  })
})
