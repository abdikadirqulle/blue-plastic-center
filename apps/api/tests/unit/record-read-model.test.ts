import { randomUUID } from "node:crypto"
import { beforeEach, describe, expect, it } from "vitest"
import { MemoryLedgerRepository } from "../../src/modules/accounting/memory-ledger-repository.js"
import { MemoryInventoryMovements } from "../../src/modules/inventory/memory-inventory-movements.js"
import { MemoryInvoiceRepository } from "../../src/modules/sales/memory-invoice-repository.js"
import { InvoiceService } from "../../src/modules/sales/invoice-service.js"
import { RecordReadModel } from "../../src/modules/read-models/record-read-model.js"
import { MemoryResourceRepository } from "../../src/repositories/memory-resource-repository.js"
import type { RequestContext, ResourceRecord } from "../../src/platform/types.js"

const companyId = "00000000-0000-4000-8000-00000000000a"
const branchId = "00000000-0000-4000-8000-0000000000a1"
const userId = "00000000-0000-4000-8000-000000000003"
const customerId = "30000000-0000-4000-8000-000000000001"
const itemId = "40000000-0000-4000-8000-000000000002"
const warehouseId = "50000000-0000-4000-8000-000000000001"
const receivableId = "60000000-0000-4000-8000-000000000001"

const context: RequestContext = {
  requestId: randomUUID(),
  companyId,
  branchId,
  principal: { userId, name: "Accountant", role: "accountant" },
}

function record(
  id: string,
  module: string,
  resource: string,
  data: Record<string, unknown>,
  status = "active",
): ResourceRecord {
  const now = new Date().toISOString()
  return {
    id,
    module,
    resource,
    companyId,
    branchId,
    status,
    version: 1,
    data,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
    isDeleted: false,
  }
}

describe("record read model", () => {
  let resources: MemoryResourceRepository
  let ledger: MemoryLedgerRepository
  let inventory: MemoryInventoryMovements
  let invoices: MemoryInvoiceRepository
  let sales: InvoiceService
  let readModel: RecordReadModel

  beforeEach(async () => {
    resources = new MemoryResourceRepository()
    ledger = new MemoryLedgerRepository(resources)
    inventory = new MemoryInventoryMovements()
    invoices = new MemoryInvoiceRepository(resources, ledger, inventory)
    sales = new InvoiceService(invoices)
    readModel = new RecordReadModel(resources, ledger, invoices, inventory)

    await resources.create(
      record(customerId, "sales", "customers", { displayName: "Banaadir Trading" }),
    )
    await resources.create(
      record(itemId, "inventory", "items", {
        name: "Crate",
        sku: "CRT-1",
        type: "inventory",
        openingQuantity: "999",
      }),
    )
    await resources.create(
      record(warehouseId, "inventory", "warehouses", { name: "Main", code: "MAIN" }),
    )
    await resources.create(
      record(receivableId, "accounting", "chart-of-accounts", {
        accountNumber: "1200",
        accountName: "Accounts receivable",
        accountType: "asset",
        systemKey: "accounts_receivable",
        openingBalance: "999",
      }),
    )
    inventory.seedBalance({
      companyId,
      warehouseId,
      itemId,
      quantity: "10.0000",
      inventoryValue: "300.0000",
    })
  })

  const postInvoice = async (dueDate: string) => {
    const draft = await sales.create(context, {
      status: "draft",
      data: {
        customerId,
        invoiceDate: "2026-01-10",
        dueDate,
        currency: "USD",
        lines: [
          { itemId, warehouseId, description: "Crate", quantity: "4", unitPrice: "50.00" },
        ],
      },
    })
    return sales.post(context, draft.id, `post-${draft.id}`)
  }

  it("reads a customer balance from the invoice tables, not from the customer form", async () => {
    await postInvoice("2020-02-10")
    const customer = await resources.findById(
      { companyId, module: "sales", resource: "customers" },
      customerId,
    )
    const [enriched] = await readModel.enrich(context, "sales", "customers", [customer!])

    expect(enriched.data.openBalance).toBe("200.0000")
    expect(enriched.data.overdueBalance).toBe("200.0000")
    expect(enriched.data.openInvoices).toBe(1)
    expect(enriched.data.lastInvoiceDate).toBe("2026-01-10")
  })

  it("leaves a draft invoice out of the customer balance", async () => {
    await sales.create(context, {
      status: "draft",
      data: {
        customerId,
        invoiceDate: "2026-01-10",
        dueDate: "2026-02-10",
        currency: "USD",
        lines: [{ itemId, warehouseId, description: "Crate", quantity: "1", unitPrice: "50.00" }],
      },
    })
    const customer = await resources.findById(
      { companyId, module: "sales", resource: "customers" },
      customerId,
    )
    const [enriched] = await readModel.enrich(context, "sales", "customers", [customer!])

    expect(enriched.data.openBalance).toBe("0.0000")
    expect(enriched.data.openInvoices).toBe(0)

    const customerRecord = await resources.findById(
      { companyId, module: "sales", resource: "customers" },
      customerId,
    )
    const activity = await readModel.activity(
      context,
      "sales",
      "customers",
      customerRecord!,
    )
    expect(activity.rows).toHaveLength(1)
    expect(activity.rows[0].status).toBe("draft")
    expect(activity.rows[0].running).toBeUndefined()
  })

  it("reads stock on hand from the stock ledger instead of the opening quantity", async () => {
    await postInvoice("2026-02-10")
    const item = await resources.findById(
      { companyId, module: "inventory", resource: "items" },
      itemId,
    )
    const [enriched] = await readModel.enrich(context, "inventory", "items", [item!])

    expect(enriched.data.quantityOnHand).toBe("6.0000")
    expect(enriched.data.inventoryValue).toBe("180.0000")
    expect(enriched.data.averageCost).toBe("30.0000")
  })

  it("reads an account balance from the ledger instead of the opening balance", async () => {
    await postInvoice("2026-02-10")
    const account = await resources.findById(
      { companyId, module: "accounting", resource: "chart-of-accounts" },
      receivableId,
    )
    const [enriched] = await readModel.enrich(context, "accounting", "chart-of-accounts", [
      account!,
    ])

    expect(enriched.data.balance).toBe("200.0000")
    expect(enriched.data.debitTotal).toBe("200.0000")
    expect(enriched.data.creditTotal).toBe("0.0000")
  })

  it("signs a credit-balance account the way a bookkeeper reads it", async () => {
    const payableId = "60000000-0000-4000-8000-000000000009"
    await resources.create(
      record(payableId, "accounting", "chart-of-accounts", {
        accountNumber: "2000",
        accountName: "Accounts payable",
        accountType: "liability",
      }),
    )
    await ledger.post(context, {
      sourceModule: "accounting",
      sourceType: "journal",
      sourceId: randomUUID(),
      idempotencyKey: "manual-1",
      transactionDate: "2026-01-15",
      currency: "USD",
      lines: [
        { accountId: payableId, debit: "0", credit: "500.00" },
        { accountId: receivableId, debit: "500.00", credit: "0" },
      ],
    })
    const account = await resources.findById(
      { companyId, module: "accounting", resource: "chart-of-accounts" },
      payableId,
    )
    const [enriched] = await readModel.enrich(context, "accounting", "chart-of-accounts", [
      account!,
    ])

    expect(enriched.data.balance).toBe("500.0000")
  })

  it("names the customer a payment points at", async () => {
    const payment = record("70000000-0000-4000-8000-000000000001", "sales", "payments", {
      customerId,
      paymentDate: "2026-01-20",
      amount: "120.00",
    })
    await resources.create(payment)
    const [enriched] = await readModel.enrich(context, "sales", "payments", [payment])

    expect(enriched.data.customerName).toBe("Banaadir Trading")
  })

  it("builds a customer register from invoices and payments with a running balance", async () => {
    const posted = await postInvoice("2026-02-10")
    await resources.create(
      record("70000000-0000-4000-8000-000000000002", "sales", "payments", {
        customerId,
        documentNumber: "PAY-1",
        paymentDate: "2026-01-20",
        amount: "50.00",
      }),
    )
    const customer = await resources.findById(
      { companyId, module: "sales", resource: "customers" },
      customerId,
    )
    const activity = await readModel.activity(context, "sales", "customers", customer!)

    expect(activity.kind).toBe("customer")
    expect(activity.metrics.find((entry) => entry.key === "openBalance")?.value).toBe(
      "150.0000",
    )
    expect(activity.rows).toHaveLength(2)
    expect(activity.rows[0]).toMatchObject({
      kind: "payment",
      reference: "PAY-1",
      amount: "-50.00",
      running: "150.0000",
    })
    expect(activity.rows[1]).toMatchObject({
      kind: "invoice",
      reference: String(posted.data.documentNumber),
      running: "200.0000",
    })
  })

  it("takes a recorded payment off what the customer owes", async () => {
    await postInvoice("2026-02-10")
    await resources.create(
      record("70000000-0000-4000-8000-000000000004", "sales", "payments", {
        customerId,
        paymentDate: "2026-01-20",
        amount: "80.00",
      }),
    )
    const customer = await resources.findById(
      { companyId, module: "sales", resource: "customers" },
      customerId,
    )
    const [enriched] = await readModel.enrich(context, "sales", "customers", [customer!])

    expect(enriched.data.openBalance).toBe("120.0000")
  })

  it("never counts a payment already applied to an invoice twice", async () => {
    const posted = await postInvoice("2026-02-10")
    await resources.update({
      ...posted,
      status: "paid",
      data: { ...posted.data, amountPaid: "200.0000", balanceDue: "0.0000" },
    })
    await resources.create(
      record("70000000-0000-4000-8000-000000000005", "sales", "payments", {
        customerId,
        paymentDate: "2026-02-20",
        amount: "200.00",
        allocations: [{ invoiceId: posted.id, amount: "200.00" }],
      }, "applied"),
    )
    const customer = await resources.findById(
      { companyId, module: "sales", resource: "customers" },
      customerId,
    )
    const [enriched] = await readModel.enrich(context, "sales", "customers", [customer!])

    expect(enriched.data.openBalance).toBe("0.0000")
  })

  it("shows a cash sale in the customer history without moving the balance", async () => {
    await postInvoice("2026-02-10")
    await resources.create(
      record("70000000-0000-4000-8000-000000000003", "sales", "sales-receipts", {
        customerId,
        documentNumber: "SR-1",
        saleDate: "2026-01-25",
        total: "90.00",
        paymentMethod: "Cash",
      }, "paid"),
    )
    const customer = await resources.findById(
      { companyId, module: "sales", resource: "customers" },
      customerId,
    )
    const activity = await readModel.activity(context, "sales", "customers", customer!)

    expect(activity.rows.map((entry) => entry.kind)).toEqual(["receipt", "invoice"])
    expect(activity.rows[0]).toMatchObject({
      kind: "receipt",
      reference: "SR-1",
      amount: "90.00",
      affectsBalance: false,
    })
    expect(activity.rows[0].running).toBeUndefined()
    expect(activity.metrics.find((entry) => entry.key === "openBalance")?.value).toBe(
      "200.0000",
    )
  })

  it("nets vendor payments against recorded bills", async () => {
    const vendorId = "90000000-0000-4000-8000-000000000001"
    await resources.create(
      record(vendorId, "purchasing", "vendors", { displayName: "SomPolymer" }),
    )
    await resources.create(
      record("90000000-0000-4000-8000-000000000002", "purchasing", "bills", {
        vendorId,
        documentNumber: "BILL-1",
        billDate: "2026-01-05",
        dueDate: "2026-02-05",
        amount: "500.00",
      }, "open"),
    )
    await resources.create(
      record("90000000-0000-4000-8000-000000000003", "purchasing", "bill-payments", {
        vendorId,
        documentNumber: "BP-1",
        paymentDate: "2026-01-12",
        amount: "200.00",
      }, "paid"),
    )
    const vendor = await resources.findById(
      { companyId, module: "purchasing", resource: "vendors" },
      vendorId,
    )
    const [enriched] = await readModel.enrich(context, "purchasing", "vendors", [vendor!])
    const activity = await readModel.activity(context, "purchasing", "vendors", vendor!)

    expect(enriched.data.openBalance).toBe("300.0000")
    expect(activity.rows.map((entry) => entry.kind)).toEqual(["payment", "bill"])
    expect(activity.rows[0].running).toBe("300.0000")
  })

  it("reads a bill that records its value as a total rather than an amount", async () => {
    const vendorId = "90000000-0000-4000-8000-000000000005"
    await resources.create(
      record(vendorId, "purchasing", "vendors", { displayName: "Gulf Resin" }),
    )
    await resources.create(
      record("90000000-0000-4000-8000-000000000006", "purchasing", "bills", {
        vendorId,
        documentNumber: "BILL-2",
        billDate: "2026-01-05",
        total: "740.00",
        balanceDue: "740.00",
      }, "open"),
    )
    const vendor = await resources.findById(
      { companyId, module: "purchasing", resource: "vendors" },
      vendorId,
    )
    const [enriched] = await readModel.enrich(context, "purchasing", "vendors", [vendor!])
    const activity = await readModel.activity(context, "purchasing", "vendors", vendor!)

    expect(enriched.data.openBalance).toBe("740.0000")
    expect(activity.rows[0]).toMatchObject({ amount: "740.00", running: "740.0000" })
  })

  it("calculates the line totals a generic document never stored", async () => {
    const bill = record("90000000-0000-4000-8000-000000000004", "purchasing", "bills", {
      vendorId: "90000000-0000-4000-8000-000000000001",
      lines: [
        { description: "Resin", quantity: "3", unitPrice: "25.50" },
        { description: "Freight", quantity: "1", unitPrice: "40" },
      ],
    })
    await resources.create(bill)
    const [enriched] = await readModel.enrich(context, "purchasing", "bills", [bill])
    const lines = enriched.data.lines as Array<Record<string, unknown>>

    expect(lines[0].lineTotal).toBe("76.5000")
    expect(lines[1].lineTotal).toBe("40.0000")
    expect(enriched.data.total).toBe("116.5000")
  })

  it("builds an item register from stock movements", async () => {
    await postInvoice("2026-02-10")
    const item = await resources.findById(
      { companyId, module: "inventory", resource: "items" },
      itemId,
    )
    const activity = await readModel.activity(context, "inventory", "items", item!)

    expect(activity.kind).toBe("item")
    expect(activity.metrics.map((entry) => entry.key)).toEqual([
      "quantityOnHand",
      "inventoryValue",
      "averageCost",
    ])
    expect(activity.rows).toHaveLength(1)
    expect(activity.rows[0]).toMatchObject({
      kind: "movement",
      quantity: "-4.0000",
      running: "6.0000",
    })
  })

  it("builds an account register with a running balance and the audit trail", async () => {
    await postInvoice("2026-02-10")
    const account = await resources.findById(
      { companyId, module: "accounting", resource: "chart-of-accounts" },
      receivableId,
    )
    const activity = await readModel.activity(
      context,
      "accounting",
      "chart-of-accounts",
      account!,
    )

    expect(activity.kind).toBe("account")
    expect(activity.rows).toHaveLength(1)
    expect(activity.rows[0]).toMatchObject({
      kind: "journal",
      debit: "200.0000",
      credit: "0.0000",
      running: "200.0000",
    })
  })

  it("returns only the audit trail for a record without a register", async () => {
    const expense = record("80000000-0000-4000-8000-000000000001", "purchasing", "expenses", {
      payee: "Utility",
      amount: "40.00",
    })
    await resources.create(expense)
    const activity = await readModel.activity(context, "purchasing", "expenses", expense)

    expect(activity.kind).toBe("none")
    expect(activity.rows).toEqual([])
  })
})
