import {
  createDraftFormSchema,
  getOperationalSchema,
  operationalSchemas,
  validateOperationalData,
  type FormField,
} from "../src/index.js"
import { describe, expect, it } from "vitest"

const expectedResources = {
  sales: [
    "credit-notes", "customers", "deposits", "estimates",
    "invoices", "payments", "recurring-invoices", "refund-receipts",
    "sales-orders", "sales-receipts", "statements",
  ],
  purchasing: [
    "approvals", "bill-payments", "bills", "checks", "expenses",
    "purchase-orders", "receipts", "vendor-credits", "vendors",
  ],
  inventory: [
    "adjustments", "assemblies", "fulfillment", "items", "landed-costs",
    "lots-serials", "reorder-planning", "stock-counts", "stock-levels",
    "transfers", "warehouses",
  ],
  banking: [
    "accounts", "bank-feeds", "bank-rules", "cash-flow", "checks",
    "deposits", "reconciliation", "transactions", "transfers",
  ],
  accounting: [
    "audit-log", "budgets", "chart-of-accounts", "classes", "close-center",
    "fiscal-periods", "fixed-assets", "journal-entries", "recurring", "registers",
  ],
  projects: [
    "change-orders", "expenses", "profitability", "progress-billing",
    "projects", "tasks", "time",
  ],
  payroll: [
    "benefits", "employees", "leave", "liabilities", "loans", "pay-runs",
    "reports", "timesheets",
  ],
} as const

describe("shared operational contracts", () => {
  it.each(Object.entries(expectedResources))(
    "registers every %s resource",
    (moduleName, resources) => {
      expect(Object.keys(operationalSchemas[moduleName as keyof typeof operationalSchemas]).sort())
        .toEqual([...resources].sort())
    },
  )

  it("returns strict known schemas and leaves unknown modules untouched", () => {
    expect(getOperationalSchema("sales", "customers")).toBeDefined()
    expect(() => validateOperationalData("sales", "customers", {})).toThrow()
    expect(validateOperationalData("unknown", "resource", { value: 1 })).toEqual({ value: 1 })
  })

  it("supports intentionally partial incomplete records", () => {
    expect(validateOperationalData("sales", "invoices", { memo: "Work in progress" }, {
      partial: true,
    })).toEqual({ memo: "Work in progress" })
  })
})

describe("shared form contracts", () => {
  it("creates a Zod draft schema from typed form fields", () => {
    const fields: FormField[] = [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "amount", label: "Amount", type: "number", required: true },
      { name: "active", label: "Active", type: "checkbox" },
    ]
    const schema = createDraftFormSchema(fields)

    expect(schema.parse({ name: "Customer", amount: "10", active: "true" }))
      .toEqual({ name: "Customer", amount: "10", active: "true" })
    expect(() => schema.parse({ name: "", amount: "" })).toThrow()
  })
})
