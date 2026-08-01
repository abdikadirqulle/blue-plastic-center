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

const notFound = { status: 404, code: "NOT_FOUND" }

describe("MVP scope", () => {
  it("answers 404 for modules and resources parked until after the MVP", async () => {
    const service = new ResourceService(new MemoryResourceRepository())

    await expect(
      service.list(context, "payroll", "employees", {
        page: 1,
        pageSize: 10,
        order: "desc",
      }),
    ).rejects.toMatchObject(notFound)
    await expect(
      service.create(context, "sales", "estimates", { data: {} }),
    ).rejects.toMatchObject(notFound)
    await expect(
      service.get(context, "banking", "reconciliation", "any-id"),
    ).rejects.toMatchObject(notFound)
    await expect(
      service.create(context, "projects", "projects", { data: {} }),
    ).rejects.toMatchObject(notFound)
  })

  it("keeps serving the modules the MVP ships", async () => {
    const service = new ResourceService(new MemoryResourceRepository())

    await expect(
      service.create(context, "sales", "customers", {
        status: "active",
        data: { displayName: "Banaadir Trading Co." },
      }),
    ).resolves.toMatchObject({ module: "sales", resource: "customers" })
  })
})
