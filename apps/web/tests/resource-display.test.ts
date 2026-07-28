import { describe, expect, it } from "vitest"
import type { ApiRecord } from "../lib/api-client"
import {
  recordIdentifier,
  recordTitle,
} from "../features/resources/resource-api"

const record = (data: Record<string, unknown>): ApiRecord => ({
  id: "bd2246f5-2355-4d1e-aba6-43e645845905",
  module: "sales",
  resource: "invoices",
  companyId: "company-1",
  branchId: "branch-1",
  status: "draft",
  version: 1,
  data,
  createdAt: "2026-07-28T00:00:00.000Z",
  createdBy: "admin-1",
  updatedAt: "2026-07-28T00:00:00.000Z",
  updatedBy: "admin-1",
  isDeleted: false,
})

describe("resource display mapping", () => {
  it("uses a business document number instead of the database UUID", () => {
    const invoice = record({
      documentNumber: "INV-00042",
      customerId: "customer-uuid",
    })

    expect(recordIdentifier(invoice)).toBe("INV-00042")
    expect(recordIdentifier(invoice)).not.toBe(invoice.id)
    expect(recordTitle(invoice)).toBe("INV-00042")
  })

  it("uses names and business codes for master records", () => {
    const customer = record({ displayName: "Banaadir Trading Co." })
    const item = record({ name: "Blue drum", sku: "DRUM-BLUE" })

    expect(recordIdentifier(customer)).toBe("Banaadir Trading Co.")
    expect(recordIdentifier(item)).toBe("DRUM-BLUE")
  })
})
