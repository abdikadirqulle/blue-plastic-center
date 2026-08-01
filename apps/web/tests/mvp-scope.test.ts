import { describe, expect, it } from "vitest"
import { isDeferredField } from "@blue-plastic/types"
import {
  moduleDefinitions,
  resourceConfigs,
} from "../features/resources/resource-config"

const fieldNames = (key: string) =>
  resourceConfigs[key].formSections.flatMap((section) =>
    section.fields.map((field) => field.name),
  )

describe("MVP catalog", () => {
  it("offers only the modules the MVP ships", () => {
    expect(Object.keys(moduleDefinitions).sort()).toEqual([
      "accounting",
      "inventory",
      "purchasing",
      "reports",
      "sales",
      "settings",
    ])
    expect(moduleDefinitions.sales.resources.map((entry) => entry.slug)).toEqual(
      ["invoices", "customers", "payments", "sales-receipts"],
    )
  })

  it("has no route for a deferred module or resource", () => {
    expect(resourceConfigs["sales/estimates"]).toBeUndefined()
    expect(resourceConfigs["purchasing/purchase-orders"]).toBeUndefined()
    expect(resourceConfigs["banking/accounts"]).toBeUndefined()
    expect(resourceConfigs["payroll/employees"]).toBeUndefined()
    expect(resourceConfigs["projects/projects"]).toBeUndefined()
    expect(resourceConfigs["accounting/classes"]).toBeUndefined()
    expect(resourceConfigs["sales/recurring-invoices"]).toBeUndefined()
  })

  it("keeps deferred fields and columns out of every MVP form", () => {
    for (const [key, config] of Object.entries(resourceConfigs)) {
      for (const section of config.formSections)
        for (const field of section.fields)
          expect(
            isDeferredField(field.name, field.label),
            `${key} still asks for ${field.name}`,
          ).toBe(false)
      for (const column of config.columns)
        expect(isDeferredField(column), `${key} still shows ${column}`).toBe(
          false,
        )
    }
  })

  it("leaves the invoice form with its MVP fields", () => {
    const names = fieldNames("sales/invoices")

    expect(names).toContain("customer")
    expect(names).toContain("invoiceDate")
    expect(names).toContain("dueDate")
    expect(names).toContain("memo")
    expect(names).not.toContain("currency")
    expect(names).not.toContain("exchangeRate")
    // Inventory posting still needs the location stock leaves from.
    expect(names).toContain("warehouse")
    expect(names).not.toContain("discountType")
    expect(names).not.toContain("discountValue")
  })
})
