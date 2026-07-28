import { describe, expect, it } from "vitest"
import type { RequestContext } from "../../src/platform/types.js"
import { MemoryResourceRepository } from "../../src/repositories/memory-resource-repository.js"
import { ResourceService } from "../../src/services/resource-service.js"

const context: RequestContext = {
  requestId: "unit-request",
  companyId: "company-1",
  branchId: "branch-1",
  principal: {
    userId: "admin-1",
    name: "Administrator",
    role: "administrator",
  },
}

describe("ResourceService", () => {
  it("allows incomplete form saves while keeping draft validation strict", async () => {
    const service = new ResourceService(new MemoryResourceRepository())

    await expect(service.create(context, "sales", "customers", {
      status: "incomplete",
      data: {},
    })).resolves.toMatchObject({ status: "incomplete", data: {} })

    await expect(service.create(context, "sales", "customers", {
      status: "draft",
      data: {},
    })).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: ["displayName"] })],
    })
  })

  it("numbers documents, enforces optimistic locking, and soft deletes", async () => {
    const repository = new MemoryResourceRepository()
    const service = new ResourceService(repository)
    const record = await service.create(context, "sales", "invoices", {
      data: {
        customerId: "customer-1",
        invoiceDate: "2026-07-28",
        dueDate: "2026-08-28",
        currency: "USD",
        lines: [{
          accountId: "4000-sales",
          description: "Items",
          quantity: "1",
          unitPrice: "10",
        }],
      },
    })

    expect(record.data.documentNumber).toBe("INV-00001")
    await expect(service.update(context, "sales", "invoices", record.id, {
      version: 99,
      data: { memo: "stale" },
    })).rejects.toMatchObject({ status: 409, code: "CONFLICT" })

    await service.remove(context, "sales", "invoices", record.id)
    await expect(service.get(context, "sales", "invoices", record.id))
      .rejects.toMatchObject({ status: 404, code: "NOT_FOUND" })

    const trash = await service.listTrash(context, {
      page: 1,
      pageSize: 10,
      order: "desc",
      module: "sales",
      resource: "invoices",
    })
    expect(trash.data[0]).toMatchObject({ id: record.id, isDeleted: true })
  })
})
