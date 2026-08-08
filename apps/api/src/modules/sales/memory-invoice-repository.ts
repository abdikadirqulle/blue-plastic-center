import { randomUUID } from "node:crypto"
import {
  invoiceCreateDataSchema,
  type InvoiceVoidInput,
} from "@blue-plastic/types"
import { conflict, notFound, validation } from "../../platform/errors.js"
import type { ListQuery, RequestContext } from "../../platform/types.js"
import type { ResourceRepository } from "../../repositories/resource-repository.js"
import type { MemoryLedgerRepository } from "../accounting/memory-ledger-repository.js"
import { decimalToMinor, minorToDecimal } from "../accounting/ledger-math.js"
import type { MemoryInventoryMovements } from "../inventory/memory-inventory-movements.js"
import {
  canDeleteInvoice,
  canEditInvoice,
  canPostInvoice,
  canVoidInvoice,
  reducesStock,
  revenueTarget,
  type InvoiceLineSource,
} from "./invoice-domain.js"
import { buildInvoicePosting, type InvoicePostingLine } from "./invoice-posting.js"
import { calculateInvoiceSettlement } from "./invoice-settlement.js"
import {
  toInvoiceRecord,
  type InvoiceLineView,
  type InvoiceRowView,
} from "./invoice-record.js"
import { calculateInvoiceTotals } from "./invoice-totals.js"
import type {
  InvoiceCreateOptions,
  InvoiceRepository,
  InvoiceWrite,
} from "./invoice-repository.js"

interface StoredLine extends InvoiceLineView {
  invoiceId: string
  source: InvoiceLineSource
}

interface StoredInvoice extends InvoiceRowView {
  postingIdempotencyKey?: string
}

interface IdempotencyClaim {
  requestHash: string
  invoiceId: string
}

const isoDate = (value: string) => value.slice(0, 10)

/**
 * Normalized in-memory invoice store. It mirrors the PostgreSQL repository's
 * tables, constraints and posting order so the default runtime and the test
 * suite exercise the same invoice behaviour without a database.
 */
export class MemoryInvoiceRepository implements InvoiceRepository {
  private invoices: StoredInvoice[] = []
  private lines: StoredLine[] = []
  private sequence = 0
  private readonly claims = new Map<string, IdempotencyClaim>()

  constructor(
    private readonly resources: ResourceRepository,
    private readonly ledger: MemoryLedgerRepository,
    private readonly inventory: MemoryInventoryMovements,
  ) {}

  async list(context: RequestContext, query: ListQuery) {
    const customerNames = await this.customerNames(context)
    const search = query.search?.toLowerCase()
    const matching = this.invoices.filter((invoice) => {
      if (
        invoice.companyId !== context.companyId ||
        invoice.branchId !== context.branchId ||
        invoice.isDeleted
      )
        return false
      const record = this.project(invoice, customerNames.get(invoice.customerId))
      if (query.status && record.status !== query.status) return false
      if (!search) return true
      return [
        invoice.invoiceNumber,
        String(record.data.customerName ?? ""),
        invoice.customerPurchaseOrder ?? "",
        invoice.memo ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(search)
    })
    const ordered = [...matching].sort((left, right) =>
      query.order === "asc"
        ? left.createdAt.localeCompare(right.createdAt)
        : right.createdAt.localeCompare(left.createdAt),
    )
    const start = (query.page - 1) * query.pageSize
    return {
      data: ordered
        .slice(start, start + query.pageSize)
        .map((invoice) =>
          this.project(invoice, customerNames.get(invoice.customerId)),
        ),
      total: ordered.length,
    }
  }

  private async customerNames(context: RequestContext) {
    const customers = await this.resources.list(
      { companyId: context.companyId, module: "sales", resource: "customers" },
      { page: 1, pageSize: 1000, order: "asc" },
    )
    return new Map(
      customers.data.map((customer) => [
        customer.id,
        String(customer.data.displayName ?? ""),
      ]),
    )
  }

  async findById(context: RequestContext, id: string) {
    const invoice = this.find(context, id)
    if (!invoice) return undefined
    return this.projectDetail(context, invoice)
  }

  async listByCustomers(context: RequestContext, customerIds: string[]) {
    const wanted = new Set(customerIds)
    return this.invoices
      .filter(
        (invoice) =>
          invoice.companyId === context.companyId &&
          !invoice.isDeleted &&
          wanted.has(invoice.customerId),
      )
      .sort((left, right) => right.invoiceDate.localeCompare(left.invoiceDate))
      .map((invoice) => ({
        id: invoice.id,
        customerId: invoice.customerId,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate,
        dueDate: invoice.dueDate,
        status: this.project(invoice).status,
        total: invoice.total,
        amountPaid: invoice.amountPaid,
        balanceDue: invoice.balanceDue,
      }))
  }

  /** Test-runtime equivalent of the locked relational settlement projection. */
  applyPaymentSettlement(context: RequestContext, id: string, amount: string) {
    const invoice = this.find(context, id)
    if (!invoice) throw validation("Allocation invoice was not found for this company")
    const paid = decimalToMinor(invoice.amountPaid) + decimalToMinor(amount)
    const balance = decimalToMinor(invoice.balanceDue) - decimalToMinor(amount)
    if (balance < 0n)
      throw validation(`Payment exceeds invoice ${invoice.invoiceNumber}'s open amount`)
    invoice.amountPaid = minorToDecimal(paid)
    invoice.balanceDue = minorToDecimal(balance)
    invoice.status = balance === 0n ? "paid" : "partially_paid"
    invoice.version += 1
    invoice.updatedAt = new Date().toISOString()
    invoice.updatedBy = context.principal.userId
  }

  /** Rebuild settlement from remaining posted allocation totals using the canonical helper. */
  applyCanonicalSettlement(context: RequestContext, id: string, postedAllocationTotal: string) {
    const invoice = this.find(context, id)
    if (!invoice) throw validation("Allocation invoice was not found for this company")
    const settlement = calculateInvoiceSettlement({
      invoiceStatus: invoice.status,
      total: invoice.total,
      postedAllocationTotal,
    })
    invoice.amountPaid = settlement.amountPaid
    invoice.balanceDue = settlement.balanceDue
    invoice.status = settlement.status
    invoice.version += 1
    invoice.updatedAt = new Date().toISOString()
    invoice.updatedBy = context.principal.userId
  }

  snapshotPaymentSettlement(ids: string[]) {
    const snapshots = this.invoices
      .filter((invoice) => ids.includes(invoice.id))
      .map((invoice) => ({ invoice, value: { ...invoice } }))
    return () => snapshots.forEach(({ invoice, value }) => Object.assign(invoice, value))
  }

  async create(
    context: RequestContext,
    input: InvoiceWrite,
    options: InvoiceCreateOptions = {},
  ) {
    const parsed = invoiceCreateDataSchema.parse(input.data)
    if (options.idempotencyKey) {
      if (!options.requestHash) throw validation("An idempotency request hash is required")
      const claimKey = `${context.companyId}:${options.idempotencyKey}`
      const known = this.claims.get(claimKey)
      if (known) {
        if (known.requestHash !== options.requestHash)
          throw conflict("Idempotency key was already used with a different request")
        const existing = this.find(context, known.invoiceId)
        if (existing) return this.projectDetail(context, existing)
        throw conflict("The idempotent invoice request is still being processed")
      }
    }

    const customer = await this.requireCustomer(context, parsed.customerId)
    const calculated = calculateInvoiceTotals(parsed)
    const sources = await this.resolveLineSources(context, calculated.lines)
    const now = new Date().toISOString()
    const invoice: StoredInvoice = {
      id: randomUUID(),
      companyId: context.companyId,
      branchId: context.branchId,
      customerId: customer.id,
      invoiceNumber: parsed.documentNumber ?? this.nextInvoiceNumber(),
      invoiceDate: parsed.invoiceDate,
      dueDate: parsed.dueDate,
      currency: parsed.currency,
      exchangeRate: parsed.exchangeRate,
      status: "draft",
      customerPurchaseOrder: parsed.customerPurchaseOrder,
      memo: parsed.memo,
      discountType: parsed.discountType,
      discountValue: parsed.discountValue,
      subtotal: calculated.subtotal,
      discountTotal: calculated.discountTotal,
      taxTotal: calculated.taxTotal,
      total: calculated.total,
      amountPaid: calculated.amountPaid,
      balanceDue: calculated.balanceDue,
      version: 1,
      createdAt: now,
      createdBy: context.principal.userId,
      updatedAt: now,
      updatedBy: context.principal.userId,
      isDeleted: false,
    }
    if (this.invoices.some(
      (existing) =>
        existing.companyId === context.companyId &&
        existing.invoiceNumber === invoice.invoiceNumber,
    ))
      throw conflict(`Invoice number ${invoice.invoiceNumber} already exists`)

    this.invoices.push(invoice)
    this.writeLines(invoice.id, calculated.lines, sources)
    if (options.idempotencyKey)
      this.claims.set(`${context.companyId}:${options.idempotencyKey}`, {
        requestHash: String(options.requestHash),
        invoiceId: invoice.id,
      })
    await this.audit(context, "create", invoice.id, {
      after: {
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        status: "draft",
      },
    })
    return this.projectDetail(context, invoice)
  }

  async update(context: RequestContext, id: string, input: InvoiceWrite) {
    const current = this.find(context, id)
    if (!current) throw notFound("Invoice was not found")
    if (!canEditInvoice(current.status)) throw conflict("Only draft invoices can be edited")
    if (input.version !== undefined && input.version !== current.version)
      throw conflict("Invoice was changed by another user. Refresh and try again.")
    const merged = invoiceCreateDataSchema.parse({
      customerId: current.customerId,
      invoiceDate: current.invoiceDate,
      dueDate: current.dueDate,
      currency: current.currency,
      exchangeRate: current.exchangeRate,
      customerPurchaseOrder: current.customerPurchaseOrder ?? undefined,
      memo: current.memo ?? undefined,
      discountType: current.discountType ?? "none",
      discountValue: current.discountValue ?? "0",
      lines: this.linesOf(current.id).map((line) => ({
        itemId: line.itemId ?? undefined,
        accountId: line.accountId ?? undefined,
        warehouseId: line.warehouseId ?? undefined,
        description: line.description,
        unit: line.unit ?? undefined,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxRate: line.taxRate,
      })),
      ...input.data,
    })
    const customer = await this.requireCustomer(context, merged.customerId)
    const calculated = calculateInvoiceTotals(merged)
    const sources = await this.resolveLineSources(context, calculated.lines)
    const before = { version: current.version, total: current.total }
    Object.assign(current, {
      customerId: customer.id,
      invoiceDate: merged.invoiceDate,
      dueDate: merged.dueDate,
      currency: merged.currency,
      exchangeRate: merged.exchangeRate,
      customerPurchaseOrder: merged.customerPurchaseOrder,
      memo: merged.memo,
      discountType: merged.discountType,
      discountValue: merged.discountValue,
      subtotal: calculated.subtotal,
      discountTotal: calculated.discountTotal,
      taxTotal: calculated.taxTotal,
      total: calculated.total,
      balanceDue: calculated.balanceDue,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: context.principal.userId,
    } satisfies Partial<StoredInvoice>)
    this.lines = this.lines.filter((line) => line.invoiceId !== current.id)
    this.writeLines(current.id, calculated.lines, sources)
    await this.audit(context, "update", current.id, {
      before,
      after: { version: current.version, total: calculated.total },
    })
    return this.projectDetail(context, current)
  }

  async post(context: RequestContext, id: string, idempotencyKey: string) {
    const current = this.find(context, id)
    if (!current) throw notFound("Invoice was not found")
    if (!canPostInvoice(current.status)) {
      if (current.postingIdempotencyKey === idempotencyKey)
        return this.projectDetail(context, current)
      throw conflict("Only a draft invoice can be posted")
    }
    if (Number(current.total) <= 0) throw validation("A zero-value invoice cannot be posted")

    const customer = await this.requireCustomer(context, current.customerId)
    const lines = this.linesOf(current.id)
    const restoreLedger = this.ledger.snapshot()
    const restoreInventory = this.inventory.snapshot()
    const snapshot = { ...current }
    try {
      const postingLines: InvoicePostingLine[] = []
      for (const line of lines) {
        const target = revenueTarget(line.source)
        const posting: InvoicePostingLine = {
          revenueAccountId: target.revenueAccountId,
          revenueSystemAccountKey: target.revenueSystemAccountKey,
          description: line.description,
          lineTotal: line.lineTotal,
          discountAmount: line.discountAmount,
          taxAmount: line.taxAmount,
        }
        if (reducesStock(line.source)) {
          const movement = await this.inventory.apply(undefined, context, {
            warehouseId: await this.requireWarehouse(context, line.source),
            itemId: String(line.itemId),
            kind: "sale",
            quantity: line.quantity,
            occurredAt: `${current.invoiceDate}T00:00:00.000Z`,
            sourceModule: "sales",
            sourceType: "invoice",
            sourceId: current.id,
            sourceLineId: line.id,
            idempotencyKey: `${idempotencyKey}:line:${line.lineNumber}`,
          })
          posting.cost = movement.costApplied
          posting.inventoryAccountId = line.source.inventoryAccountId
          posting.cogsAccountId = line.source.expenseAccountId
        }
        postingLines.push(posting)
      }

      await this.ledger.post(
        context,
        buildInvoicePosting({
          invoiceId: current.id,
          invoiceNumber: current.invoiceNumber,
          invoiceDate: current.invoiceDate,
          currency: current.currency,
          exchangeRate: current.exchangeRate,
          customerName: String(customer.data.displayName ?? "Customer"),
          total: current.total,
          discountTotal: current.discountTotal,
          taxTotal: current.taxTotal,
          idempotencyKey,
          lines: postingLines,
        }),
      )

      const now = new Date().toISOString()
      Object.assign(current, {
        status: "open",
        postedAt: now,
        postedBy: context.principal.userId,
        postingIdempotencyKey: idempotencyKey,
        version: current.version + 1,
        updatedAt: now,
        updatedBy: context.principal.userId,
      } satisfies Partial<StoredInvoice>)
    } catch (error) {
      restoreLedger()
      restoreInventory()
      Object.assign(current, snapshot)
      throw error
    }
    await this.audit(context, "post", current.id, {
      before: { status: "draft" },
      after: { status: "open", total: current.total },
    })
    return this.projectDetail(context, current)
  }

  async void(
    context: RequestContext,
    id: string,
    input: InvoiceVoidInput,
    idempotencyKey: string,
  ) {
    const current = this.find(context, id)
    if (!current) throw notFound("Invoice was not found")
    if (current.status === "voided") return this.projectDetail(context, current)
    if (!canVoidInvoice(current.status))
      throw conflict("Only a posted invoice can be voided")

    const restoreLedger = this.ledger.snapshot()
    const restoreInventory = this.inventory.snapshot()
    const snapshot = { ...current }
    try {
      const voidDate = input.voidDate ?? isoDate(new Date().toISOString())
      await this.ledger.reverseTransaction(context, {
        sourceModule: "sales",
        sourceType: "invoice",
        sourceId: current.id,
        reversalDate: voidDate,
        idempotencyKey: `${idempotencyKey}:reversal`,
        memo: input.reason ?? `Void of invoice ${current.invoiceNumber}`,
      })
      const movements = await this.inventory.listBySource(context, {
        sourceModule: "sales",
        sourceType: "invoice",
        sourceId: current.id,
      })
      for (const movement of movements) {
        if (!movement.quantityDelta.startsWith("-")) continue
        await this.inventory.apply(undefined, context, {
          warehouseId: movement.warehouseId,
          itemId: movement.itemId,
          kind: "positive-adjustment",
          quantity: movement.quantityDelta.slice(1),
          totalCost: movement.costApplied,
          occurredAt: `${voidDate}T00:00:00.000Z`,
          sourceModule: "sales",
          sourceType: "invoice",
          sourceId: current.id,
          sourceLineId: movement.sourceLineId,
          idempotencyKey: `${movement.idempotencyKey}:void`,
        })
      }
      const now = new Date().toISOString()
      Object.assign(current, {
        status: "voided",
        voidedAt: now,
        voidedBy: context.principal.userId,
        voidReason: input.reason,
        balanceDue: "0.0000",
        version: current.version + 1,
        updatedAt: now,
        updatedBy: context.principal.userId,
      } satisfies Partial<StoredInvoice>)
    } catch (error) {
      restoreLedger()
      restoreInventory()
      Object.assign(current, snapshot)
      throw error
    }
    await this.audit(context, "void", current.id, {
      before: { status: snapshot.status },
      after: { status: "voided", reason: input.reason },
    })
    return this.projectDetail(context, current)
  }

  async remove(context: RequestContext, id: string) {
    const current = this.find(context, id)
    if (!current) throw notFound("Invoice was not found")
    if (!canDeleteInvoice(current.status))
      throw conflict("Posted invoices are immutable. Void the invoice instead.")
    const now = new Date().toISOString()
    Object.assign(current, {
      isDeleted: true,
      deletedAt: now,
      version: current.version + 1,
      updatedAt: now,
      updatedBy: context.principal.userId,
    } satisfies Partial<StoredInvoice>)
    await this.audit(context, "delete", current.id, {
      before: { status: current.status, invoiceNumber: current.invoiceNumber },
    })
  }

  private find(context: RequestContext, id: string) {
    return this.invoices.find(
      (invoice) =>
        invoice.id === id &&
        invoice.companyId === context.companyId &&
        invoice.branchId === context.branchId &&
        !invoice.isDeleted,
    )
  }

  private linesOf(invoiceId: string) {
    return this.lines
      .filter((line) => line.invoiceId === invoiceId)
      .sort((left, right) => left.lineNumber - right.lineNumber)
  }

  /** List projection: header figures only, matching the SQL list query. */
  private project(invoice: StoredInvoice, customerName?: string) {
    return toInvoiceRecord(invoice, { customerName })
  }

  private async projectDetail(context: RequestContext, invoice: StoredInvoice) {
    const customer = await this.resources.findById(
      { companyId: context.companyId, module: "sales", resource: "customers" },
      invoice.customerId,
    )
    const posting = this.ledger.findPosting(context.companyId, {
      sourceModule: "sales",
      sourceType: "invoice",
      sourceId: invoice.id,
    })
    const reversal = this.ledger.findPosting(
      context.companyId,
      { sourceModule: "sales", sourceType: "invoice", sourceId: invoice.id },
      "reversal",
    )
    const movements = await this.inventory.listBySource(context, {
      sourceModule: "sales",
      sourceType: "invoice",
      sourceId: invoice.id,
    })
    const auditHistory = (await this.resources.listAudit(context.companyId, 500))
      .filter((event) => event.entityId === invoice.id)
      .reverse()
      .map((event) => ({
        action: event.action,
        occurredAt: event.occurredAt,
        userId: event.userId,
      }))
    return toInvoiceRecord(invoice, {
      customerName: customer ? String(customer.data.displayName ?? "") : undefined,
      lines: this.linesOf(invoice.id),
      postingTransactionId: posting?.record.id,
      postingTransactionNumber: posting
        ? `JOU-${posting.record.id.slice(0, 8).toUpperCase()}`
        : undefined,
      reversalTransactionId: reversal?.record.id,
      inventoryMovements: movements as unknown as Array<Record<string, unknown>>,
      auditHistory,
    })
  }

  private writeLines(
    invoiceId: string,
    calculated: ReturnType<typeof calculateInvoiceTotals>["lines"],
    sources: InvoiceLineSource[],
  ) {
    calculated.forEach((line, index) => {
      const source = sources[index] ?? {}
      this.lines.push({
        id: randomUUID(),
        invoiceId,
        source,
        itemId: source.itemId,
        itemName: source.itemName,
        accountId: source.accountId,
        accountName: source.accountName,
        warehouseId: line.warehouseId ?? source.warehouseId,
        description: line.description,
        unit: line.unit,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        lineTotal: line.lineTotal,
        lineNumber: index + 1,
      })
    })
  }

  private nextInvoiceNumber() {
    this.sequence += 1
    return `INV-${String(this.sequence).padStart(5, "0")}`
  }

  private async requireCustomer(context: RequestContext, customerId: string) {
    const customer = await this.resources.findById(
      { companyId: context.companyId, module: "sales", resource: "customers" },
      customerId,
    )
    if (!customer || customer.isDeleted)
      throw validation("The selected customer is not active for this company")
    return customer
  }

  private async resolveLineSources(
    context: RequestContext,
    lines: ReturnType<typeof calculateInvoiceTotals>["lines"],
  ): Promise<InvoiceLineSource[]> {
    const sources: InvoiceLineSource[] = []
    for (const line of lines) {
      if (line.itemId) {
        const item = await this.resources.findById(
          { companyId: context.companyId, module: "inventory", resource: "items" },
          line.itemId,
        )
        if (!item || item.isDeleted)
          throw validation("An invoice item is not active for this company")
        sources.push({
          itemId: item.id,
          itemName: String(item.data.name ?? ""),
          itemType: String(item.data.type ?? "service"),
          incomeAccountId: optionalText(item.data.incomeAccountId),
          inventoryAccountId: optionalText(item.data.inventoryAccountId),
          expenseAccountId: optionalText(item.data.expenseAccountId),
          warehouseId: line.warehouseId,
        })
        continue
      }
      const account = await this.resources.findById(
        {
          companyId: context.companyId,
          module: "accounting",
          resource: "chart-of-accounts",
        },
        String(line.accountId),
      )
      if (!account || account.isDeleted)
        throw validation("Invoice account lines require an active income account")
      sources.push({
        accountId: account.id,
        accountName: String(account.data.accountName ?? account.data.name ?? ""),
      })
    }
    return sources
  }

  private async requireWarehouse(context: RequestContext, source: InvoiceLineSource) {
    if (source.warehouseId) return source.warehouseId
    const warehouses = await this.resources.list(
      {
        companyId: context.companyId,
        branchId: context.branchId,
        module: "inventory",
        resource: "warehouses",
      },
      { page: 1, pageSize: 2, order: "asc" },
    )
    if (warehouses.data.length !== 1)
      throw validation("An inventory invoice line requires a warehouse")
    return warehouses.data[0].id
  }

  private audit(
    context: RequestContext,
    action: string,
    invoiceId: string,
    changes: Record<string, unknown>,
  ) {
    return this.resources.appendAudit({
      id: randomUUID(),
      requestId: context.requestId,
      companyId: context.companyId,
      branchId: context.branchId,
      userId: context.principal.userId,
      action,
      entityType: "sales/invoices",
      entityId: invoiceId,
      occurredAt: new Date().toISOString(),
      changes,
    })
  }
}

function optionalText(value: unknown) {
  return typeof value === "string" && value ? value : undefined
}
