import { randomUUID } from "node:crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { MemoryLedgerRepository } from "../../src/modules/accounting/memory-ledger-repository.js"
import { MemoryInventoryMovements } from "../../src/modules/inventory/memory-inventory-movements.js"
import { CustomerPaymentService } from "../../src/modules/sales/customer-payment-service.js"
import { MemoryCustomerPaymentRepository } from "../../src/modules/sales/memory-customer-payment-repository.js"
import { MemoryInvoiceRepository } from "../../src/modules/sales/memory-invoice-repository.js"
import { InvoiceService } from "../../src/modules/sales/invoice-service.js"
import type { RequestContext, ResourceRecord } from "../../src/platform/types.js"
import { MemoryResourceRepository } from "../../src/repositories/memory-resource-repository.js"

const companyId = "00000000-0000-4000-8000-00000000000a"
const otherCompanyId = "00000000-0000-4000-8000-00000000000b"
const branchId = "00000000-0000-4000-8000-0000000000a1"
const otherBranchId = "00000000-0000-4000-8000-0000000000b1"
const userId = "00000000-0000-4000-8000-000000000003"
const customerId = "30000000-0000-4000-8000-000000000001"
const otherCustomerId = "30000000-0000-4000-8000-000000000002"
const accountId = "60000000-0000-4000-8000-000000000001"
const itemId = "40000000-0000-4000-8000-000000000001"

const context: RequestContext = {
  requestId: randomUUID(), companyId, branchId,
  principal: { userId, name: "Accountant", role: "accountant" },
}
const otherContext: RequestContext = {
  ...context, requestId: randomUUID(), companyId: otherCompanyId, branchId: otherBranchId,
}

function record(
  id: string,
  company: string,
  branch: string,
  module: string,
  resource: string,
  data: Record<string, unknown>,
): ResourceRecord {
  const now = new Date().toISOString()
  return {
    id, module, resource, companyId: company, branchId: branch,
    status: "active", version: 1, data,
    createdAt: now, createdBy: userId, updatedAt: now, updatedBy: userId,
    isDeleted: false,
  }
}

describe("relational customer payment foundation", () => {
  let resources: MemoryResourceRepository
  let ledger: MemoryLedgerRepository
  let invoiceRepository: MemoryInvoiceRepository
  let invoices: InvoiceService
  let repository: MemoryCustomerPaymentRepository
  let payments: CustomerPaymentService

  beforeEach(async () => {
    resources = new MemoryResourceRepository()
    ledger = new MemoryLedgerRepository(resources)
    invoiceRepository = new MemoryInvoiceRepository(resources, ledger, new MemoryInventoryMovements())
    invoices = new InvoiceService(invoiceRepository)
    repository = new MemoryCustomerPaymentRepository(resources, invoiceRepository)
    payments = new CustomerPaymentService(repository)
    await Promise.all([
      resources.create(record(customerId, companyId, branchId, "sales", "customers", { displayName: "Customer A" })),
      resources.create(record(otherCustomerId, companyId, branchId, "sales", "customers", { displayName: "Customer B" })),
      resources.create(record(accountId, companyId, branchId, "accounting", "chart-of-accounts", { accountNumber: "1020", accountName: "Bank", accountType: "asset" })),
      resources.create(record(itemId, companyId, branchId, "inventory", "items", { name: "Service", sku: "SVC", type: "service" })),
    ])
  })

  const createPayment = (amount = "100.00", customer = customerId) => payments.create(context, {
    status: "draft",
    data: {
      customerId: customer,
      paymentDate: "2026-08-08",
      amount,
      currency: "USD",
      depositToAccountId: accountId,
      paymentMethod: "bank-transfer",
      allocations: [],
    },
  })

  const createInvoice = async (customer = customerId, status: "draft" | "open" = "open") => {
    const invoice = await invoices.create(context, {
      status: "draft",
      data: {
        customerId: customer,
        invoiceDate: "2026-08-01",
        dueDate: "2026-08-31",
        currency: "USD",
        lines: [{ itemId, description: "Service", quantity: "1", unitPrice: "100.00" }],
      },
    })
    return status === "open" ? invoices.post(context, invoice.id, `post-${invoice.id}`) : invoice
  }

  it("creates, reads, lists and updates an exact relational draft without GL", async () => {
    const before = await ledger.trialBalance(companyId, "2026-01-01", "2026-12-31")
    const created = await createPayment("100.1234")
    const updated = await payments.update(context, created.id, {
      status: "draft", version: created.version,
      data: { amount: "120.1234", reference: "BANK-9" },
    })
    expect(updated.data.amount).toBe("120.1234")
    expect(updated.data.unappliedAmount).toBe("120.1234")
    expect((await payments.get(context, created.id)).id).toBe(created.id)
    expect((await payments.list(context, { page: 1, pageSize: 10, order: "desc" })).total).toBe(1)
    expect((await resources.list(
      { companyId, branchId, module: "sales", resource: "payments" },
      { page: 1, pageSize: 10, order: "desc" },
    )).total).toBe(0)
    const after = await ledger.trialBalance(companyId, "2026-01-01", "2026-12-31")
    expect(after).toEqual(before)
  })

  it("prevents clients from fabricating posted or reversed payment states", async () => {
    await expect(Promise.resolve().then(() =>
      payments.create(context, { status: "posted", data: {} })))
      .rejects.toMatchObject({ status: 409 })
    const payment = await createPayment()
    await expect(Promise.resolve().then(() =>
      payments.update(context, payment.id, { status: "reversed", data: {} })))
      .rejects.toMatchObject({ status: 409 })
  })

  it("supports partial and one-payment-to-many-invoice allocations exactly", async () => {
    const [first, second, payment] = await Promise.all([
      createInvoice(), createInvoice(), createPayment("150.0001"),
    ])
    const allocated = await payments.allocate(context, payment.id, {
      allocations: [
        { invoiceId: first.id, amount: "40.0001" },
        { invoiceId: second.id, amount: "60" },
      ],
    })
    expect(allocated.data.allocations).toHaveLength(2)
    expect(allocated.data.unappliedAmount).toBe("50.0000")
    expect(first.data.balanceDue).toBe("100.0000")
  })

  it("supports multiple draft payments reserving one invoice within its open amount", async () => {
    const invoice = await createInvoice()
    const [first, second] = await Promise.all([createPayment("50"), createPayment("50")])
    await payments.allocate(context, first.id, { allocations: [{ invoiceId: invoice.id, amount: "40" }] })
    const allocated = await payments.allocate(context, second.id, {
      allocations: [{ invoiceId: invoice.id, amount: "50" }],
    })
    expect(allocated.data.unappliedAmount).toBe("0.0000")
  })

  it("rejects payment and invoice over-allocation", async () => {
    const invoice = await createInvoice()
    const first = await createPayment("50")
    await expect(payments.allocate(context, first.id, {
      allocations: [{ invoiceId: invoice.id, amount: "50.0001" }],
    })).rejects.toMatchObject({ status: 422 })
    const reservation = await createPayment("100")
    await payments.allocate(context, reservation.id, {
      allocations: [{ invoiceId: invoice.id, amount: "80" }],
    })
    const second = await createPayment("30")
    await expect(payments.allocate(context, second.id, {
      allocations: [{ invoiceId: invoice.id, amount: "30" }],
    })).rejects.toMatchObject({ status: 422 })
  })

  it("rejects draft, voided, wrong-customer and cross-company invoices", async () => {
    const draft = await createInvoice(customerId, "draft")
    const posted = await createInvoice()
    const voided = await invoices.void(context, posted.id, { reason: "Cancelled" }, `void-${posted.id}`)
    const otherCustomerInvoice = await createInvoice(otherCustomerId)
    for (const invoice of [draft, voided, otherCustomerInvoice]) {
      const payment = await createPayment()
      await expect(payments.allocate(context, payment.id, {
        allocations: [{ invoiceId: invoice.id, amount: "10" }],
      })).rejects.toMatchObject({ status: 422 })
    }
    const payment = await createPayment()
    await expect(payments.allocate(otherContext, payment.id, {
      allocations: [{ invoiceId: posted.id, amount: "10" }],
    })).rejects.toMatchObject({ status: 404 })
  })

  it("rejects zero, negative, duplicate and excess-precision allocations", async () => {
    const invoice = await createInvoice()
    for (const amount of ["0", "-1", "1.00001"]) {
      const payment = await createPayment()
      await expect(Promise.resolve().then(() => payments.allocate(context, payment.id, {
        allocations: [{ invoiceId: invoice.id, amount }],
      }))).rejects.toMatchObject({ status: 422 })
    }
    const payment = await createPayment()
    await expect(Promise.resolve().then(() => payments.allocate(context, payment.id, {
      allocations: [
        { invoiceId: invoice.id, amount: "10" },
        { invoiceId: invoice.id, amount: "10" },
      ],
    }))).rejects.toMatchObject({ status: 422 })
  })

  it("soft-deletes only drafts", async () => {
    const payment = await createPayment()
    await payments.remove(context, payment.id)
    await expect(payments.get(context, payment.id)).rejects.toMatchObject({ status: 404 })
  })
})
