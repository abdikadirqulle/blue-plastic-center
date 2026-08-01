import { randomUUID } from "node:crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { MemoryLedgerRepository } from "../../src/modules/accounting/memory-ledger-repository.js"
import { decimalToMinor } from "../../src/modules/accounting/ledger-math.js"
import { MemoryInventoryMovements } from "../../src/modules/inventory/memory-inventory-movements.js"
import { MemoryInvoiceRepository } from "../../src/modules/sales/memory-invoice-repository.js"
import { InvoiceService } from "../../src/modules/sales/invoice-service.js"
import { MemoryResourceRepository } from "../../src/repositories/memory-resource-repository.js"
import type { RequestContext, ResourceRecord } from "../../src/platform/types.js"

const companyA = "00000000-0000-4000-8000-00000000000a"
const companyB = "00000000-0000-4000-8000-00000000000b"
const branchA = "00000000-0000-4000-8000-0000000000a1"
const branchB = "00000000-0000-4000-8000-0000000000b1"
const userId = "00000000-0000-4000-8000-000000000003"

const customerId = "30000000-0000-4000-8000-000000000001"
const serviceItemId = "40000000-0000-4000-8000-000000000001"
const stockItemId = "40000000-0000-4000-8000-000000000002"
const warehouseId = "50000000-0000-4000-8000-000000000001"

function contextFor(companyId: string, branchId: string): RequestContext {
  return {
    requestId: randomUUID(),
    companyId,
    branchId,
    principal: { userId, name: "Accountant", role: "accountant" },
  }
}

const contextA = contextFor(companyA, branchA)
const contextB = contextFor(companyB, branchB)

function referenceRecord(
  id: string,
  companyId: string,
  branchId: string,
  module: string,
  resource: string,
  data: Record<string, unknown>,
): ResourceRecord {
  const now = new Date().toISOString()
  return {
    id,
    module,
    resource,
    companyId,
    branchId,
    status: "active",
    version: 1,
    data,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
    isDeleted: false,
  }
}

const serviceLine = {
  itemId: serviceItemId,
  description: "Consulting engagement",
  quantity: "2",
  unitPrice: "150.00",
}

const stockLine = {
  itemId: stockItemId,
  warehouseId,
  description: "Blue plastic crate",
  quantity: "4",
  unitPrice: "50.00",
}

const draftInput = {
  customerId,
  invoiceDate: "2026-08-01",
  dueDate: "2126-08-31",
  currency: "USD",
  customerPurchaseOrder: "PO-7781",
  memo: "First delivery",
  lines: [serviceLine],
}

describe("invoice vertical slice", () => {
  let resources: MemoryResourceRepository
  let ledger: MemoryLedgerRepository
  let inventory: MemoryInventoryMovements
  let repository: MemoryInvoiceRepository
  let service: InvoiceService

  beforeEach(async () => {
    resources = new MemoryResourceRepository()
    ledger = new MemoryLedgerRepository(resources)
    inventory = new MemoryInventoryMovements()
    repository = new MemoryInvoiceRepository(resources, ledger, inventory)
    service = new InvoiceService(repository)

    await resources.create(
      referenceRecord(customerId, companyA, branchA, "sales", "customers", {
        displayName: "Banaadir Trading Co.",
      }),
    )
    await resources.create(
      referenceRecord(serviceItemId, companyA, branchA, "inventory", "items", {
        name: "Consulting",
        sku: "SVC-1",
        type: "service",
      }),
    )
    await resources.create(
      referenceRecord(stockItemId, companyA, branchA, "inventory", "items", {
        name: "Crate",
        sku: "CRT-1",
        type: "inventory",
      }),
    )
    await resources.create(
      referenceRecord(warehouseId, companyA, branchA, "inventory", "warehouses", {
        name: "Main warehouse",
        code: "MAIN",
      }),
    )
    inventory.seedBalance({
      companyId: companyA,
      warehouseId,
      itemId: stockItemId,
      quantity: "10.0000",
      inventoryValue: "300.0000",
    })
  })

  const postingLines = (invoiceId: string) => {
    const posting = ledger.findPosting(companyA, {
      sourceModule: "sales",
      sourceType: "invoice",
      sourceId: invoiceId,
    })
    return posting?.lines ?? []
  }

  const totalsOf = (lines: Array<Record<string, unknown>>) =>
    lines.reduce(
      (totals, line) => ({
        debit: totals.debit + decimalToMinor(line.debit),
        credit: totals.credit + decimalToMinor(line.credit),
      }),
      { debit: 0n, credit: 0n },
    )

  it("saves every draft field and calculates the totals on the server", async () => {
    const created = await service.create(contextA, {
      status: "draft",
      data: { ...draftInput, subtotal: "1.00", total: "1.00" },
    })

    expect(created.status).toBe("draft")
    expect(created.data.customerId).toBe(customerId)
    expect(created.data.customerName).toBe("Banaadir Trading Co.")
    expect(created.data.customerPurchaseOrder).toBe("PO-7781")
    expect(created.data.memo).toBe("First delivery")
    expect(created.data.invoiceDate).toBe("2026-08-01")
    expect(created.data.dueDate).toBe("2126-08-31")
    expect(created.data.documentNumber).toBe("INV-00001")
    expect(created.data.subtotal).toBe("300.0000")
    expect(created.data.total).toBe("300.0000")
    expect(created.data.balanceDue).toBe("300.0000")
    expect(created.data.lines).toHaveLength(1)
    expect((created.data.lines as Array<Record<string, unknown>>)[0]).toMatchObject({
      itemId: serviceItemId,
      itemName: "Consulting",
      quantity: "2",
      unitPrice: "150.00",
      lineTotal: "300.0000",
    })
  })

  it("does not touch the ledger for a draft invoice", async () => {
    const created = await service.create(contextA, { status: "draft", data: draftInput })
    expect(postingLines(created.id)).toHaveLength(0)
    expect(created.data.postingTransactionId).toBeUndefined()
  })

  it("posts a service invoice as receivable against service revenue", async () => {
    const created = await service.create(contextA, { status: "draft", data: draftInput })
    const posted = await service.post(contextA, created.id, "post-service-1")

    expect(posted.status).toBe("open")
    expect(posted.data.postingTransactionId).toBeTruthy()
    const lines = postingLines(created.id)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({
      systemAccountKey: "accounts_receivable",
      debit: "300.0000",
    })
    expect(lines[1]).toMatchObject({
      systemAccountKey: "service_revenue",
      credit: "300.0000",
    })
    const movements = await inventory.listBySource(contextA, {
      sourceModule: "sales",
      sourceType: "invoice",
      sourceId: created.id,
    })
    expect(movements).toHaveLength(0)
  })

  it("posts an inventory invoice with revenue, cost of goods sold and inventory relief", async () => {
    const created = await service.create(contextA, {
      status: "draft",
      data: { ...draftInput, lines: [stockLine] },
    })
    await service.post(contextA, created.id, "post-stock-1")

    const lines = postingLines(created.id)
    expect(lines.map((line) => line.systemAccountKey)).toEqual([
      "accounts_receivable",
      "sales_revenue",
      "cost_of_goods_sold",
      "inventory_asset",
    ])
    expect(lines[0].debit).toBe("200.0000")
    expect(lines[1].credit).toBe("200.0000")
    // Weighted average of 300.00 across 10 units releases 30.00 per unit.
    expect(lines[2].debit).toBe("120.0000")
    expect(lines[3].credit).toBe("120.0000")
  })

  it("keeps every posted journal balanced, including tax", async () => {
    const created = await service.create(contextA, {
      status: "draft",
      data: {
        ...draftInput,
        lines: [{ ...serviceLine, taxRate: "5" }, { ...stockLine, taxRate: "5" }],
      },
    })
    const posted = await service.post(contextA, created.id, "post-tax-1")

    expect(posted.data.taxTotal).toBe("25.0000")
    expect(posted.data.total).toBe("525.0000")
    const lines = postingLines(created.id)
    const totals = totalsOf(lines)
    expect(totals.debit).toBe(totals.credit)
    expect(lines.some((line) => line.systemAccountKey === "tax_payable")).toBe(true)
  })

  it("reduces stock exactly once and leaves service items alone", async () => {
    const created = await service.create(contextA, {
      status: "draft",
      data: { ...draftInput, lines: [serviceLine, stockLine] },
    })
    await service.post(contextA, created.id, "post-mixed-1")

    const balance = inventory.balanceOf(companyA, warehouseId, stockItemId)
    expect(balance.quantity).toBe("6.0000")
    expect(balance.inventoryValue).toBe("180.0000")
    const movements = await inventory.listBySource(contextA, {
      sourceModule: "sales",
      sourceType: "invoice",
      sourceId: created.id,
    })
    expect(movements).toHaveLength(1)
    expect(movements[0].itemId).toBe(stockItemId)
    expect(movements[0].quantityDelta).toBe("-4.0000")
  })

  it("does not duplicate the journal or the stock movement on a retried post", async () => {
    const created = await service.create(contextA, {
      status: "draft",
      data: { ...draftInput, lines: [stockLine] },
    })
    const first = await service.post(contextA, created.id, "post-retry-1")
    const second = await service.post(contextA, created.id, "post-retry-1")

    expect(second.id).toBe(first.id)
    expect(second.data.postingTransactionId).toBe(first.data.postingTransactionId)
    expect(postingLines(created.id)).toHaveLength(4)
    const movements = await inventory.listBySource(contextA, {
      sourceModule: "sales",
      sourceType: "invoice",
      sourceId: created.id,
    })
    expect(movements).toHaveLength(1)
    expect(inventory.balanceOf(companyA, warehouseId, stockItemId).quantity).toBe("6.0000")
  })

  it("rolls the invoice, journal and inventory back when posting fails", async () => {
    const created = await service.create(contextA, {
      status: "draft",
      data: { ...draftInput, lines: [{ ...stockLine, quantity: "999" }] },
    })

    await expect(service.post(contextA, created.id, "post-fail-1")).rejects.toMatchObject({
      status: 422,
    })
    const reloaded = await service.get(contextA, created.id)
    expect(reloaded.status).toBe("draft")
    expect(reloaded.data.postingTransactionId).toBeUndefined()
    expect(postingLines(created.id)).toHaveLength(0)
    expect(inventory.balanceOf(companyA, warehouseId, stockItemId).quantity).toBe("10.0000")
  })

  it("lists invoices from the relational store with the money columns", async () => {
    await service.create(contextA, { status: "draft", data: draftInput })
    const posted = await service.create(contextA, {
      status: "draft",
      data: { ...draftInput, lines: [stockLine] },
    })
    await service.post(contextA, posted.id, "post-list-1")

    const listed = await service.list(contextA, {
      page: 1,
      pageSize: 20,
      order: "desc",
    })
    expect(listed.total).toBe(2)
    expect(listed.data.map((invoice) => invoice.status).sort()).toEqual(["draft", "open"])
    const openInvoice = listed.data.find((invoice) => invoice.status === "open")
    expect(openInvoice?.data).toMatchObject({
      documentNumber: "INV-00002",
      total: "200.0000",
      amountPaid: "0.0000",
      balanceDue: "200.0000",
      currency: "USD",
    })
    expect(openInvoice?.data.dueDate).toBe("2126-08-31")
  })

  it("returns the full invoice, its lines and its journal reference on detail", async () => {
    const created = await service.create(contextA, {
      status: "draft",
      data: { ...draftInput, lines: [serviceLine, stockLine] },
    })
    await service.post(contextA, created.id, "post-detail-1")
    const detail = await service.get(contextA, created.id)

    expect(detail.data.customerName).toBe("Banaadir Trading Co.")
    expect(detail.data.lines).toHaveLength(2)
    expect(detail.data.postingTransactionId).toBeTruthy()
    expect(detail.data.inventoryMovements).toHaveLength(1)
    expect(
      (detail.data.auditHistory as Array<Record<string, unknown>>).map(
        (event) => event.action,
      ),
    ).toEqual(["create", "post"])
  })

  it("voids a posted invoice with a reversal and preserves the original records", async () => {
    const created = await service.create(contextA, {
      status: "draft",
      data: { ...draftInput, lines: [stockLine] },
    })
    await service.post(contextA, created.id, "post-void-1")
    const voided = await service.void(
      contextA,
      created.id,
      { voidDate: "2026-08-05", reason: "Customer cancelled" },
      "void-1",
    )

    expect(voided.status).toBe("voided")
    expect(voided.data.voidReason).toBe("Customer cancelled")
    expect(voided.data.reversalTransactionId).toBeTruthy()
    expect(voided.data.postingTransactionId).toBeTruthy()
    expect(voided.data.lines).toHaveLength(1)
    const reversal = ledger.findPosting(
      companyA,
      { sourceModule: "sales", sourceType: "invoice", sourceId: created.id },
      "reversal",
    )
    expect(reversal?.lines[0]).toMatchObject({ credit: "200.0000", debit: "0.0000" })
    expect(inventory.balanceOf(companyA, warehouseId, stockItemId).quantity).toBe("10.0000")
    expect(inventory.balanceOf(companyA, warehouseId, stockItemId).inventoryValue).toBe(
      "300.0000",
    )
  })

  it("deletes a draft invoice but never a posted one", async () => {
    const draft = await service.create(contextA, { status: "draft", data: draftInput })
    const posted = await service.create(contextA, { status: "draft", data: draftInput })
    await service.post(contextA, posted.id, "post-delete-1")

    await service.remove(contextA, draft.id)
    await expect(service.get(contextA, draft.id)).rejects.toMatchObject({ status: 404 })
    await expect(service.remove(contextA, posted.id)).rejects.toMatchObject({ status: 409 })
  })

  it("never exposes another company's invoice", async () => {
    const created = await service.create(contextA, { status: "draft", data: draftInput })

    await expect(service.get(contextB, created.id)).rejects.toMatchObject({ status: 404 })
    const listed = await service.list(contextB, { page: 1, pageSize: 20, order: "desc" })
    expect(listed.total).toBe(0)
    await expect(
      service.post(contextB, created.id, "cross-tenant-1"),
    ).rejects.toMatchObject({ status: 404 })
  })
})
