import { describe, expect, it, vi } from "vitest"
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
    const record = await service.create(context, "sales", "estimates", {
      data: {
        customerId: "customer-1",
        estimateDate: "2026-07-28",
        currency: "USD",
        lines: [{
          accountId: "4000-sales",
          description: "Items",
          quantity: "1",
          unitPrice: "10",
        }],
      },
    })

    expect(record.data.documentNumber).toBe("EST-00001")
    await expect(service.update(context, "sales", "estimates", record.id, {
      version: 99,
      data: { memo: "stale" },
    })).rejects.toMatchObject({ status: 409, code: "CONFLICT" })

    await service.remove(context, "sales", "estimates", record.id)
    await expect(service.get(context, "sales", "estimates", record.id))
      .rejects.toMatchObject({ status: 404, code: "NOT_FOUND" })

    const trash = await service.listTrash(context, {
      page: 1,
      pageSize: 10,
      order: "desc",
      module: "sales",
      resource: "estimates",
    })
    expect(trash.data[0]).toMatchObject({ id: record.id, isDeleted: true })
  })

  it("delegates invoices to the normalized repository instead of the JSONB store", async () => {
    const repository = new MemoryResourceRepository()
    const invoices = {
      list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      findById: vi.fn().mockResolvedValue(undefined),
      create: vi.fn().mockResolvedValue({ id: "invoice-1" }),
      update: vi.fn().mockResolvedValue({ id: "invoice-1" }),
      post: vi.fn(),
      void: vi.fn(),
      remove: vi.fn(),
    }
    const service = new ResourceService(repository, invoices)
    const data = {
      customerId: "customer-1",
      invoiceDate: "2026-07-28",
      dueDate: "2026-08-28",
      currency: "USD",
      lines: [{ accountId: "4000-sales", description: "Items", quantity: "1", unitPrice: "10" }],
    }

    await service.create(context, "sales", "invoices", { data })
    await service.list(context, "sales", "invoices", { page: 1, pageSize: 10, order: "desc" })
    await service.remove(context, "sales", "invoices", "invoice-1")

    expect(invoices.create).toHaveBeenCalledOnce()
    expect(invoices.list).toHaveBeenCalledOnce()
    expect(invoices.remove).toHaveBeenCalledWith(context, "invoice-1")
    const stored = await repository.list(
      { companyId: context.companyId, module: "sales", resource: "invoices" },
      { page: 1, pageSize: 10, order: "desc" },
    )
    expect(stored.total).toBe(0)
  })
})
