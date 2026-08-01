import { randomUUID } from "node:crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { RequestContext, ResourceRecord } from "../../src/platform/types.js"
import type { InvoiceRepository } from "../../src/modules/sales/invoice-repository.js"
import { InvoiceService } from "../../src/modules/sales/invoice-service.js"

const context: RequestContext = {
  requestId: randomUUID(),
  companyId: "00000000-0000-4000-8000-000000000001",
  branchId: "00000000-0000-4000-8000-000000000002",
  principal: {
    userId: "00000000-0000-4000-8000-000000000003",
    name: "Accountant",
    role: "accountant",
  },
}

const invoice: ResourceRecord = {
  id: "50000000-0000-4000-8000-000000000001",
  module: "sales",
  resource: "invoices",
  companyId: context.companyId,
  branchId: context.branchId,
  status: "draft",
  version: 1,
  data: {},
  createdAt: new Date().toISOString(),
  createdBy: context.principal.userId,
  updatedAt: new Date().toISOString(),
  updatedBy: context.principal.userId,
  isDeleted: false,
}

const validData = {
  customerId: "30000000-0000-4000-8000-000000000001",
  invoiceDate: "2026-08-01",
  dueDate: "2026-08-31",
  currency: "USD",
  lines: [{
    accountId: "10000000-0000-4000-8000-000000004010",
    description: "Service",
    quantity: "1",
    unitPrice: "100.00",
  }],
}

describe("InvoiceService", () => {
  let repository: InvoiceRepository
  let service: InvoiceService

  beforeEach(() => {
    repository = {
      list: vi.fn().mockResolvedValue({ data: [invoice], total: 1 }),
      findById: vi.fn().mockResolvedValue(invoice),
      create: vi.fn().mockResolvedValue(invoice),
      update: vi.fn().mockResolvedValue(invoice),
      post: vi.fn().mockResolvedValue({ ...invoice, status: "open" }),
    }
    service = new InvoiceService(repository)
  })

  it("creates only a draft and passes the canonical write contract", async () => {
    await service.create(context, { status: "draft", data: validData })
    expect(repository.create).toHaveBeenCalledWith(
      context,
      expect.objectContaining({
        status: "draft",
        data: expect.objectContaining({
          customerId: validData.customerId,
          invoiceDate: validData.invoiceDate,
          dueDate: validData.dueDate,
          currency: validData.currency,
        }),
      }),
      undefined,
    )
  })

  it("does not allow clients to forge a posted invoice", async () => {
    expect(() => service.create(context, { status: "open", data: validData }))
      .toThrow(expect.objectContaining({ status: 409 }))
    expect(repository.create).not.toHaveBeenCalled()
  })

  it("requires posting idempotency and delegates one secured transition", async () => {
    expect(() => service.post(context, invoice.id, ""))
      .toThrow(expect.objectContaining({ status: 422 }))
    await service.post(context, invoice.id, "invoice-post-1")
    expect(repository.post).toHaveBeenCalledWith(context, invoice.id, "invoice-post-1")
  })

  it("returns not found instead of leaking another tenant's invoice", async () => {
    vi.mocked(repository.findById).mockResolvedValue(undefined)
    await expect(service.get({ ...context, companyId: randomUUID() }, invoice.id))
      .rejects.toMatchObject({ status: 404 })
  })
})
