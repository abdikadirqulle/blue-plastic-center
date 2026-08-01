import { randomUUID } from "node:crypto"
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm"
import {
  invoiceCreateDataSchema,
  type InvoiceVoidInput,
} from "@blue-plastic/types"
import type { Database, DatabaseTransaction } from "../../db/client.js"
import {
  accountingTransactions,
  accounts,
  auditEvents,
  branches,
  companies,
  currencies,
  customers,
  documentSequences,
  idempotencyKeys,
  invoiceLines,
  invoices,
  items,
  warehouses,
} from "../../db/schema.js"
import { conflict, notFound, validation } from "../../platform/errors.js"
import type { ListQuery, RequestContext } from "../../platform/types.js"
import type { PostgresLedgerRepository } from "../accounting/postgres-ledger-repository.js"
import type { PostgresInventoryMovements } from "../inventory/postgres-inventory-movements.js"
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

type InvoiceRow = typeof invoices.$inferSelect
type InvoiceLineRow = typeof invoiceLines.$inferSelect
type Executor = Database | DatabaseTransaction

interface ResolvedLine {
  source: InvoiceLineSource
  description: string
  unit?: string
  quantity: string
  unitPrice: string
  discountAmount: string
  taxRate: string
  taxAmount: string
  lineTotal: string
  warehouseId?: string
}

const dateText = (date: Date) => date.toISOString().slice(0, 10)
const timestamp = (value: Date | null | undefined) => value?.toISOString() ?? undefined

function toRowView(row: InvoiceRow): InvoiceRowView {
  return {
    id: row.id,
    companyId: row.companyId,
    branchId: row.branchId,
    customerId: row.customerId,
    invoiceNumber: row.invoiceNumber,
    invoiceDate: dateText(row.invoiceDate),
    dueDate: dateText(row.dueDate),
    currency: row.currency,
    exchangeRate: row.exchangeRate,
    status: row.status,
    customerPurchaseOrder: row.customerPurchaseOrder,
    memo: row.memo,
    subtotal: row.subtotal,
    discountTotal: row.discountTotal,
    taxTotal: row.taxTotal,
    total: row.total,
    amountPaid: row.amountPaid,
    balanceDue: row.balanceDue,
    postedAt: timestamp(row.postedAt),
    postedBy: row.postedBy,
    voidedAt: timestamp(row.voidedAt),
    voidedBy: row.voidedBy,
    voidReason: row.voidReason,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedBy,
    isDeleted: row.isDeleted,
    deletedAt: timestamp(row.deletedAt),
  }
}

function toLineView(
  line: InvoiceLineRow,
  names: { itemName?: string | null; accountName?: string | null } = {},
): InvoiceLineView {
  return {
    id: line.id,
    itemId: line.itemId,
    itemName: names.itemName,
    accountId: line.accountId,
    accountName: names.accountName,
    warehouseId: line.warehouseId,
    description: line.description,
    unit: line.unit,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountAmount: line.discountAmount,
    taxRate: line.taxRate,
    taxAmount: line.taxAmount,
    lineTotal: line.lineTotal,
    lineNumber: line.lineNumber,
  }
}

export class PostgresInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly db: Database,
    private readonly ledger: PostgresLedgerRepository,
    private readonly inventory: PostgresInventoryMovements,
  ) {}

  async list(context: RequestContext, query: ListQuery) {
    const conditions = [
      eq(invoices.companyId, context.companyId),
      eq(invoices.branchId, context.branchId),
      eq(invoices.isDeleted, false),
      isNull(invoices.deletedAt),
    ]
    if (query.status) conditions.push(eq(invoices.status, query.status))
    if (query.search)
      conditions.push(
        sql`concat_ws(' ', ${invoices.invoiceNumber}, ${customers.displayName}, ${invoices.customerPurchaseOrder}, ${invoices.memo}) ILIKE ${`%${query.search}%`}`,
      )
    const where = and(...conditions)
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(where)
    const rows = await this.db
      .select({ invoice: invoices, customerName: customers.displayName })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(where)
      .orderBy(query.order === "asc" ? asc(invoices.createdAt) : desc(invoices.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
    return {
      data: rows.map(({ invoice, customerName }) =>
        toInvoiceRecord(toRowView(invoice), { customerName }),
      ),
      total: count,
    }
  }

  async findById(context: RequestContext, id: string) {
    return this.readInvoice(this.db, context, id)
  }

  async create(
    context: RequestContext,
    input: InvoiceWrite,
    options: InvoiceCreateOptions = {},
  ) {
    const parsed = invoiceCreateDataSchema.parse(input.data)
    return this.db.transaction(async (transaction) => {
      const invoiceId = randomUUID()
      if (options.idempotencyKey) {
        if (!options.requestHash) throw validation("An idempotency request hash is required")
        const [claim] = await transaction
          .insert(idempotencyKeys)
          .values({
            companyId: context.companyId,
            key: options.idempotencyKey,
            requestHash: options.requestHash,
            resourceRecordId: invoiceId,
            expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
          })
          .onConflictDoNothing()
          .returning({ id: idempotencyKeys.id })
        if (!claim) {
          const [known] = await transaction
            .select()
            .from(idempotencyKeys)
            .where(
              and(
                eq(idempotencyKeys.companyId, context.companyId),
                eq(idempotencyKeys.key, options.idempotencyKey),
              ),
            )
            .limit(1)
          if (!known) throw conflict("Invoice idempotency claim could not be acquired")
          if (known.requestHash !== options.requestHash)
            throw conflict("Idempotency key was already used with a different request")
          const existing = await this.readInvoice(
            transaction,
            context,
            known.resourceRecordId,
          )
          if (existing) return existing
          throw conflict("The idempotent invoice request is still being processed")
        }
      }

      await this.validateTenantContext(transaction, context, parsed.currency)
      const customer = await this.requireCustomer(transaction, context, parsed.customerId)
      const calculated = calculateInvoiceTotals(parsed)
      const resolved = await this.resolveLines(transaction, context, calculated.lines)
      const invoiceNumber =
        parsed.documentNumber ?? (await this.nextInvoiceNumber(transaction, context.companyId))
      const now = new Date()
      const [row] = await transaction
        .insert(invoices)
        .values({
          id: invoiceId,
          companyId: context.companyId,
          branchId: context.branchId,
          customerId: customer.id,
          invoiceNumber,
          invoiceDate: new Date(`${parsed.invoiceDate}T00:00:00.000Z`),
          dueDate: new Date(`${parsed.dueDate}T00:00:00.000Z`),
          currency: parsed.currency,
          exchangeRate: parsed.exchangeRate,
          status: "draft",
          customerPurchaseOrder: parsed.customerPurchaseOrder,
          memo: parsed.memo,
          subtotal: calculated.subtotal,
          discountTotal: calculated.discountTotal,
          taxTotal: calculated.taxTotal,
          total: calculated.total,
          amountPaid: calculated.amountPaid,
          balanceDue: calculated.balanceDue,
          createdBy: context.principal.userId,
          updatedBy: context.principal.userId,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
      await this.writeLines(transaction, invoiceId, resolved)
      await this.audit(transaction, context, "create", invoiceId, {
        after: { invoiceNumber, total: calculated.total, status: "draft" },
      })
      const created = await this.readInvoice(transaction, context, row.id)
      if (!created) throw conflict("The invoice could not be read back after creation")
      return created
    })
  }

  async update(context: RequestContext, id: string, input: InvoiceWrite) {
    return this.db.transaction(async (transaction) => {
      const current = await this.requireInvoiceRow(transaction, context, id)
      if (!canEditInvoice(current.status)) throw conflict("Only draft invoices can be edited")
      if (input.version !== undefined && input.version !== current.version)
        throw conflict("Invoice was changed by another user. Refresh and try again.")
      const currentLines = await transaction
        .select()
        .from(invoiceLines)
        .where(eq(invoiceLines.invoiceId, id))
        .orderBy(asc(invoiceLines.lineNumber))
      const merged = invoiceCreateDataSchema.parse({
        customerId: current.customerId,
        invoiceDate: dateText(current.invoiceDate),
        dueDate: dateText(current.dueDate),
        currency: current.currency,
        exchangeRate: current.exchangeRate,
        customerPurchaseOrder: current.customerPurchaseOrder ?? undefined,
        memo: current.memo ?? undefined,
        lines: currentLines.map((line) => ({
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
      await this.validateTenantContext(transaction, context, merged.currency)
      const customer = await this.requireCustomer(transaction, context, merged.customerId)
      const calculated = calculateInvoiceTotals(merged)
      const resolved = await this.resolveLines(transaction, context, calculated.lines)
      const [updated] = await transaction
        .update(invoices)
        .set({
          customerId: customer.id,
          invoiceDate: new Date(`${merged.invoiceDate}T00:00:00.000Z`),
          dueDate: new Date(`${merged.dueDate}T00:00:00.000Z`),
          currency: merged.currency,
          exchangeRate: merged.exchangeRate,
          customerPurchaseOrder: merged.customerPurchaseOrder,
          memo: merged.memo,
          subtotal: calculated.subtotal,
          discountTotal: calculated.discountTotal,
          taxTotal: calculated.taxTotal,
          total: calculated.total,
          balanceDue: calculated.balanceDue,
          version: current.version + 1,
          updatedBy: context.principal.userId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.companyId, context.companyId),
            eq(invoices.branchId, context.branchId),
            eq(invoices.status, "draft"),
            eq(invoices.version, current.version),
          ),
        )
        .returning()
      if (!updated) throw conflict("Invoice changed before it could be updated")
      await transaction.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id))
      await this.writeLines(transaction, id, resolved)
      await this.audit(transaction, context, "update", id, {
        before: { version: current.version, total: current.total },
        after: { version: updated.version, total: calculated.total },
      })
      const result = await this.readInvoice(transaction, context, id)
      if (!result) throw notFound("Invoice was not found")
      return result
    })
  }

  /** The invoice write, journal, inventory and audit share one transaction. */
  async post(context: RequestContext, id: string, idempotencyKey: string) {
    return this.db.transaction(async (transaction) => {
      const current = await this.requireInvoiceRow(transaction, context, id)
      if (!canPostInvoice(current.status)) {
        const existing = await this.findPosting(transaction, context.companyId, id)
        if (existing?.idempotencyKey === idempotencyKey) {
          const record = await this.readInvoice(transaction, context, id)
          if (record) return record
        }
        throw conflict("Only a draft invoice can be posted")
      }
      if (Number(current.total) <= 0)
        throw validation("A zero-value invoice cannot be posted")

      const customer = await this.requireCustomer(transaction, context, current.customerId)
      const lines = await transaction
        .select({ line: invoiceLines, item: items })
        .from(invoiceLines)
        .leftJoin(items, eq(invoiceLines.itemId, items.id))
        .where(eq(invoiceLines.invoiceId, id))
        .orderBy(asc(invoiceLines.lineNumber))

      const postingLines: InvoicePostingLine[] = []
      for (const { line, item } of lines) {
        const source: InvoiceLineSource = {
          itemId: line.itemId ?? undefined,
          itemType: item?.type,
          incomeAccountId: item?.incomeAccountId ?? undefined,
          inventoryAccountId: item?.inventoryAccountId ?? undefined,
          expenseAccountId: item?.expenseAccountId ?? undefined,
          accountId: line.accountId ?? undefined,
        }
        const target = revenueTarget(source)
        const posting: InvoicePostingLine = {
          revenueAccountId: target.revenueAccountId,
          revenueSystemAccountKey: target.revenueSystemAccountKey,
          description: line.description,
          lineTotal: line.lineTotal,
          discountAmount: line.discountAmount,
          taxAmount: line.taxAmount,
        }
        if (reducesStock(source)) {
          if (!line.warehouseId)
            throw validation("An inventory invoice line requires a warehouse")
          const movement = await this.inventory.apply(transaction, context, {
            warehouseId: line.warehouseId,
            itemId: String(line.itemId),
            kind: "sale",
            quantity: line.quantity,
            occurredAt: `${dateText(current.invoiceDate)}T00:00:00.000Z`,
            sourceModule: "sales",
            sourceType: "invoice",
            sourceId: id,
            sourceLineId: line.id,
            idempotencyKey: `${idempotencyKey}:line:${line.lineNumber}`,
          })
          posting.cost = movement.costApplied
          posting.inventoryAccountId = source.inventoryAccountId
          posting.cogsAccountId = source.expenseAccountId
        }
        postingLines.push(posting)
      }

      await this.ledger.postInTransaction(
        transaction,
        context,
        buildInvoicePosting({
          invoiceId: id,
          invoiceNumber: current.invoiceNumber,
          invoiceDate: dateText(current.invoiceDate),
          currency: current.currency,
          exchangeRate: current.exchangeRate,
          customerName: customer.displayName,
          receivableAccountId: customer.receivableAccountId ?? undefined,
          total: current.total,
          discountTotal: current.discountTotal,
          taxTotal: current.taxTotal,
          idempotencyKey,
          lines: postingLines,
        }),
      )

      const now = new Date()
      const [updated] = await transaction
        .update(invoices)
        .set({
          status: "open",
          postedAt: now,
          postedBy: context.principal.userId,
          version: current.version + 1,
          updatedAt: now,
          updatedBy: context.principal.userId,
        })
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.companyId, context.companyId),
            eq(invoices.branchId, context.branchId),
            eq(invoices.status, "draft"),
            eq(invoices.version, current.version),
          ),
        )
        .returning({ id: invoices.id })
      if (!updated) throw conflict("Invoice changed before it could be posted")
      await this.audit(transaction, context, "post", id, {
        before: { status: "draft" },
        after: { status: "open", total: current.total },
      })
      const result = await this.readInvoice(transaction, context, id)
      if (!result) throw notFound("Posted invoice was not found")
      return result
    })
  }

  async void(
    context: RequestContext,
    id: string,
    input: InvoiceVoidInput,
    idempotencyKey: string,
  ) {
    return this.db.transaction(async (transaction) => {
      const current = await this.requireInvoiceRow(transaction, context, id)
      if (current.status === "voided") {
        const record = await this.readInvoice(transaction, context, id)
        if (record) return record
      }
      if (!canVoidInvoice(current.status))
        throw conflict("Only a posted invoice can be voided")
      const voidDate = input.voidDate ?? dateText(new Date())
      await this.ledger.reverseTransactionInTransaction(transaction, context, {
        sourceModule: "sales",
        sourceType: "invoice",
        sourceId: id,
        reversalDate: voidDate,
        idempotencyKey: `${idempotencyKey}:reversal`,
        memo: input.reason ?? `Void of invoice ${current.invoiceNumber}`,
      })
      const movements = await this.inventory.listBySource(context, {
        sourceModule: "sales",
        sourceType: "invoice",
        sourceId: id,
      })
      for (const movement of movements) {
        if (!movement.quantityDelta.startsWith("-")) continue
        await this.inventory.apply(transaction, context, {
          warehouseId: movement.warehouseId,
          itemId: movement.itemId,
          kind: "positive-adjustment",
          quantity: movement.quantityDelta.slice(1),
          totalCost: movement.costApplied,
          occurredAt: `${voidDate}T00:00:00.000Z`,
          sourceModule: "sales",
          sourceType: "invoice",
          sourceId: id,
          sourceLineId: movement.sourceLineId,
          idempotencyKey: `${movement.idempotencyKey}:void`,
        })
      }
      const now = new Date()
      const [updated] = await transaction
        .update(invoices)
        .set({
          status: "voided",
          voidedAt: now,
          voidedBy: context.principal.userId,
          voidReason: input.reason,
          balanceDue: "0.0000",
          version: current.version + 1,
          updatedAt: now,
          updatedBy: context.principal.userId,
        })
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.companyId, context.companyId),
            eq(invoices.version, current.version),
          ),
        )
        .returning({ id: invoices.id })
      if (!updated) throw conflict("Invoice changed before it could be voided")
      await this.audit(transaction, context, "void", id, {
        before: { status: current.status },
        after: { status: "voided", reason: input.reason },
      })
      const record = await this.readInvoice(transaction, context, id)
      if (!record) throw notFound("Voided invoice was not found")
      return record
    })
  }

  async remove(context: RequestContext, id: string) {
    await this.db.transaction(async (transaction) => {
      const current = await this.requireInvoiceRow(transaction, context, id)
      if (!canDeleteInvoice(current.status))
        throw conflict("Posted invoices are immutable. Void the invoice instead.")
      const now = new Date()
      const [deleted] = await transaction
        .update(invoices)
        .set({
          isDeleted: true,
          deletedAt: now,
          version: current.version + 1,
          updatedAt: now,
          updatedBy: context.principal.userId,
        })
        .where(
          and(
            eq(invoices.id, id),
            eq(invoices.companyId, context.companyId),
            eq(invoices.status, "draft"),
            eq(invoices.version, current.version),
          ),
        )
        .returning({ id: invoices.id })
      if (!deleted) throw conflict("Invoice changed before it could be deleted")
      await this.audit(transaction, context, "delete", id, {
        before: { status: current.status, invoiceNumber: current.invoiceNumber },
      })
    })
  }

  private async readInvoice(
    executor: Executor,
    context: RequestContext,
    id: string,
  ) {
    const [result] = await executor
      .select({ invoice: invoices, customerName: customers.displayName })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(
        and(
          eq(invoices.id, id),
          eq(invoices.companyId, context.companyId),
          eq(invoices.branchId, context.branchId),
          eq(invoices.isDeleted, false),
          isNull(invoices.deletedAt),
        ),
      )
      .limit(1)
    if (!result) return undefined
    const lines = await executor
      .select({ line: invoiceLines, itemName: items.name, accountName: accounts.name })
      .from(invoiceLines)
      .leftJoin(items, eq(invoiceLines.itemId, items.id))
      .leftJoin(accounts, eq(invoiceLines.accountId, accounts.id))
      .where(eq(invoiceLines.invoiceId, id))
      .orderBy(asc(invoiceLines.lineNumber))
    const posting = await this.findPosting(executor, context.companyId, id)
    const reversal = await this.findPosting(executor, context.companyId, id, "reversal")
    const movements = await this.inventory.listBySource(context, {
      sourceModule: "sales",
      sourceType: "invoice",
      sourceId: id,
    })
    const history = await executor
      .select({
        action: auditEvents.action,
        occurredAt: auditEvents.occurredAt,
        userId: auditEvents.userId,
      })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.companyId, context.companyId),
          eq(auditEvents.entityType, "sales/invoices"),
          eq(auditEvents.entityId, id),
        ),
      )
      .orderBy(asc(auditEvents.occurredAt))
    return toInvoiceRecord(toRowView(result.invoice), {
      customerName: result.customerName,
      lines: lines.map(({ line, itemName, accountName }) =>
        toLineView(line, { itemName, accountName }),
      ),
      postingTransactionId: posting?.id,
      postingTransactionNumber: posting?.transactionNumber,
      reversalTransactionId: reversal?.id,
      inventoryMovements: movements as unknown as Array<Record<string, unknown>>,
      auditHistory: history.map((event) => ({
        action: event.action,
        occurredAt: event.occurredAt.toISOString(),
        userId: event.userId,
      })),
    })
  }

  private async requireInvoiceRow(
    transaction: DatabaseTransaction,
    context: RequestContext,
    id: string,
  ) {
    const [row] = await transaction
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, id),
          eq(invoices.companyId, context.companyId),
          eq(invoices.branchId, context.branchId),
          eq(invoices.isDeleted, false),
          isNull(invoices.deletedAt),
        ),
      )
      .for("update")
      .limit(1)
    if (!row) throw notFound("Invoice was not found")
    return row
  }

  private async findPosting(
    executor: Executor,
    companyId: string,
    invoiceId: string,
    postingKind = "primary",
  ) {
    const [posting] = await executor
      .select({
        id: accountingTransactions.id,
        transactionNumber: accountingTransactions.transactionNumber,
        idempotencyKey: accountingTransactions.idempotencyKey,
      })
      .from(accountingTransactions)
      .where(
        and(
          eq(accountingTransactions.companyId, companyId),
          eq(accountingTransactions.sourceModule, "sales"),
          eq(accountingTransactions.sourceType, "invoice"),
          eq(accountingTransactions.sourceId, invoiceId),
          eq(accountingTransactions.postingKind, postingKind),
        ),
      )
      .limit(1)
    return posting
  }

  private async validateTenantContext(
    transaction: DatabaseTransaction,
    context: RequestContext,
    currencyCode: string,
  ) {
    const [company] = await transaction
      .select({ functionalCurrency: companies.functionalCurrency })
      .from(companies)
      .where(and(eq(companies.id, context.companyId), eq(companies.active, true)))
      .limit(1)
    if (!company) throw notFound("Company was not found")
    const [branch] = await transaction
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(
          eq(branches.id, context.branchId),
          eq(branches.companyId, context.companyId),
          eq(branches.active, true),
        ),
      )
      .limit(1)
    if (!branch) throw validation("The selected branch is not active for this company")
    if (currencyCode !== company.functionalCurrency) {
      const [currency] = await transaction
        .select({ id: currencies.id })
        .from(currencies)
        .where(
          and(
            eq(currencies.companyId, context.companyId),
            eq(currencies.code, currencyCode),
            eq(currencies.active, true),
          ),
        )
        .limit(1)
      if (!currency) throw validation(`Currency ${currencyCode} is not active for this company`)
    }
  }

  private async requireCustomer(
    transaction: DatabaseTransaction,
    context: RequestContext,
    customerId: string,
  ) {
    const [customer] = await transaction
      .select()
      .from(customers)
      .where(
        and(
          eq(customers.id, customerId),
          eq(customers.companyId, context.companyId),
          eq(customers.isDeleted, false),
          eq(customers.active, true),
        ),
      )
      .limit(1)
    if (!customer) throw validation("The selected customer is not active for this company")
    return customer
  }

  private async resolveLines(
    transaction: DatabaseTransaction,
    context: RequestContext,
    lines: ReturnType<typeof calculateInvoiceTotals>["lines"],
  ): Promise<ResolvedLine[]> {
    const resolved: ResolvedLine[] = []
    for (const line of lines) {
      const shared = {
        description: line.description,
        unit: line.unit,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        lineTotal: line.lineTotal,
      }
      if (line.itemId) {
        const [item] = await transaction
          .select()
          .from(items)
          .where(
            and(
              eq(items.id, line.itemId),
              eq(items.companyId, context.companyId),
              eq(items.isDeleted, false),
              eq(items.active, true),
            ),
          )
          .limit(1)
        if (!item) throw validation("An invoice item is not active for this company")
        const source: InvoiceLineSource = {
          itemId: item.id,
          itemName: item.name,
          itemType: item.type,
          incomeAccountId: item.incomeAccountId ?? undefined,
          inventoryAccountId: item.inventoryAccountId ?? undefined,
          expenseAccountId: item.expenseAccountId ?? undefined,
        }
        const warehouseId = reducesStock(source)
          ? await this.requireWarehouse(transaction, context, line.warehouseId)
          : undefined
        resolved.push({ ...shared, source, warehouseId })
        continue
      }
      const [account] = await transaction
        .select()
        .from(accounts)
        .where(
          and(
            eq(accounts.id, String(line.accountId)),
            eq(accounts.companyId, context.companyId),
            eq(accounts.active, true),
          ),
        )
        .limit(1)
      if (!account || account.type !== "income")
        throw validation("Invoice account lines require an active income account")
      resolved.push({
        ...shared,
        source: { accountId: account.id, accountName: account.name },
      })
    }
    return resolved
  }

  private async requireWarehouse(
    transaction: DatabaseTransaction,
    context: RequestContext,
    warehouseId?: string,
  ) {
    if (warehouseId) {
      const [warehouse] = await transaction
        .select({ id: warehouses.id })
        .from(warehouses)
        .where(
          and(
            eq(warehouses.id, warehouseId),
            eq(warehouses.companyId, context.companyId),
            eq(warehouses.active, true),
          ),
        )
        .limit(1)
      if (!warehouse) throw validation("The selected warehouse is not active for this company")
      return warehouse.id
    }
    const available = await transaction
      .select({ id: warehouses.id })
      .from(warehouses)
      .where(
        and(eq(warehouses.companyId, context.companyId), eq(warehouses.active, true)),
      )
      .limit(2)
    if (available.length !== 1)
      throw validation("An inventory invoice line requires a warehouse")
    return available[0].id
  }

  private async nextInvoiceNumber(transaction: DatabaseTransaction, companyId: string) {
    const documentType = "sales/invoices"
    await transaction
      .insert(documentSequences)
      .values({ companyId, documentType, prefix: "INV-", nextNumber: 1, padding: 5 })
      .onConflictDoNothing()
    const [sequence] = await transaction
      .update(documentSequences)
      .set({ nextNumber: sql`${documentSequences.nextNumber} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(documentSequences.companyId, companyId),
          eq(documentSequences.documentType, documentType),
        ),
      )
      .returning()
    return `${sequence.prefix}${String(sequence.nextNumber - 1).padStart(sequence.padding, "0")}`
  }

  private async writeLines(
    transaction: DatabaseTransaction,
    invoiceId: string,
    lines: ResolvedLine[],
  ) {
    if (!lines.length) return
    await transaction.insert(invoiceLines).values(
      lines.map((line, index) => ({
        invoiceId,
        itemId: line.source.itemId,
        accountId: line.source.accountId,
        warehouseId: line.warehouseId,
        description: line.description,
        unit: line.unit,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountAmount: line.discountAmount,
        taxRate: line.taxRate,
        taxAmount: line.taxAmount,
        lineTotal: line.lineTotal,
        lineNumber: index + 1,
      })),
    )
  }

  private audit(
    transaction: DatabaseTransaction,
    context: RequestContext,
    action: string,
    invoiceId: string,
    changes: Record<string, unknown>,
  ) {
    return transaction.insert(auditEvents).values({
      id: randomUUID(),
      requestId: context.requestId,
      companyId: context.companyId,
      branchId: context.branchId,
      userId: context.principal.userId,
      action,
      entityType: "sales/invoices",
      entityId: invoiceId,
      changes,
    })
  }
}
