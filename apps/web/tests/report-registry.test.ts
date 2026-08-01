import { describe, expect, it } from "vitest"
import {
  isReportKind,
  resolveReportDefinition,
} from "../features/reports/report-registry"

describe("report registry", () => {
  it("maps only reports backed by their own explicit read model", () => {
    expect(resolveReportDefinition("Profit and Loss")).toEqual({
      status: "available",
      kind: "profit-and-loss",
    })
    expect(resolveReportDefinition("Sales by Item Summary")).toEqual({
      status: "available",
      kind: "sales-by-item",
    })
  })

  it("does not silently redirect unsupported reports to unrelated data", () => {
    expect(resolveReportDefinition("Payroll Summary").status).toBe(
      "unsupported",
    )
    expect(resolveReportDefinition("Project Profitability Summary").status).toBe(
      "unsupported",
    )
    expect(resolveReportDefinition("Sales by Item Detail").status).toBe(
      "unsupported",
    )
    expect(resolveReportDefinition("Made-up report").status).toBe(
      "unsupported",
    )
  })

  it("validates viewer report kinds", () => {
    expect(isReportKind("balance-sheet")).toBe(true)
    expect(isReportKind("payroll-summary")).toBe(false)
    expect(isReportKind("")).toBe(false)
  })
})
