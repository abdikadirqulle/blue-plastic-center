import { afterEach, describe, expect, it, vi } from "vitest"
import { ApiClient } from "../lib/api-client"

describe("ApiClient idempotent creates", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("forwards a stable caller-provided idempotency key", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { id: "invoice-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)

    await new ApiClient("http://api.test").create(
      "sales",
      "invoices",
      { customerId: "customer-1" },
      "draft",
      "invoice-form-session-1",
    )

    expect(fetchMock).toHaveBeenCalledWith(
      "http://api.test/v1/sales/invoices",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Idempotency-Key": "invoice-form-session-1",
        }),
      }),
    )
  })
})
