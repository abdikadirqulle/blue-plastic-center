import { randomUUID } from "node:crypto"
import { and, asc, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm"
import type {
  CustomerPaymentCreateData,
  CustomerPaymentUpdateData,
} from "@blue-plastic/types"
import type { Database, DatabaseTransaction } from "../../db/client.js"
import {
  accounts,
  accountingTransactions,
  auditEvents,
  branches,
  companies,
  customerPaymentAllocations,
  customerPayments,
  customers,
  documentSequences,
  idempotencyKeys,
  invoices,
} from "../../db/schema.js"
import { addMoney, compareMoney, formatMoney, parseMoney, subtractMoney } from "../accounting/money.js"
import type { TransactionalLedgerRepository } from "../accounting/ledger-repository.js"
import { conflict, notFound, validation } from "../../platform/errors.js"
import type { ListQuery, RequestContext, ResourceRecord } from "../../platform/types.js"
import type {
  CustomerPaymentCreateOptions,
  CustomerPaymentRepository,
  PaymentAllocationInput,
} from "./customer-payment-repository.js"
import { buildCustomerPaymentPosting } from "./customer-payment-posting.js"

type Executor = Database | DatabaseTransaction
type PaymentRow = typeof customerPayments.$inferSelect

const dateText = (value: Date) => value.toISOString().slice(0, 10)
const asMoney = (value: string, label: string) => {
  try {
    return parseMoney(value)
  } catch (error) {
    throw validation(`${label} must be an exact decimal with at most 4 places`, {
      cause: error instanceof Error ? error.message : String(error),
    })
  }
}

export class PostgresCustomerPaymentRepository implements CustomerPaymentRepository {
  constructor(
    private readonly db: Database,
    private readonly ledger: TransactionalLedgerRepository,
  ) {}

  async list(context: RequestContext, query: ListQuery) {
    const conditions = [
      eq(customerPayments.companyId, context.companyId),
      eq(customerPayments.branchId, context.branchId),
      eq(customerPayments.isDeleted, false),
      isNull(customerPayments.deletedAt),
    ]
    if (query.status) conditions.push(eq(customerPayments.status, query.status))
    if (query.search)
      conditions.push(sql`concat_ws(' ', ${customerPayments.paymentNumber}, ${customers.displayName}, ${customerPayments.reference}, ${customerPayments.paymentMethod}) ILIKE ${`%${query.search}%`}`)
    const where = and(...conditions)
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(customerPayments)
      .innerJoin(customers, eq(customerPayments.customerId, customers.id))
      .where(where)
    const rows = await this.db
      .select({ payment: customerPayments, customerName: customers.displayName })
      .from(customerPayments)
      .innerJoin(customers, eq(customerPayments.customerId, customers.id))
      .where(where)
      .orderBy(query.order === "asc" ? asc(customerPayments.createdAt) : desc(customerPayments.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize)
    return {
      data: await Promise.all(rows.map(({ payment, customerName }) =>
        this.project(this.db, payment, customerName))),
      total: count,
    }
  }

  async findById(context: RequestContext, id: string) {
    return this.read(this.db, context, id)
  }

  async create(
    context: RequestContext,
    data: CustomerPaymentCreateData,
    options: CustomerPaymentCreateOptions = {},
  ) {
    return this.db.transaction(async (transaction) => {
      const id = randomUUID()
      if (options.idempotencyKey) {
        if (!options.requestHash) throw validation("An idempotency request hash is required")
        const [claim] = await transaction.insert(idempotencyKeys).values({
          companyId: context.companyId,
          key: options.idempotencyKey,
          requestHash: options.requestHash,
          resourceRecordId: id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
        }).onConflictDoNothing().returning({ id: idempotencyKeys.id })
        if (!claim) {
          const [known] = await transaction.select().from(idempotencyKeys).where(and(
            eq(idempotencyKeys.companyId, context.companyId),
            eq(idempotencyKeys.key, options.idempotencyKey),
          )).limit(1)
          if (!known) throw conflict("Payment idempotency claim could not be acquired")
          if (known.requestHash !== options.requestHash)
            throw conflict("Idempotency key was already used with a different request")
          const existing = await this.read(transaction, context, known.resourceRecordId)
          if (existing) return existing
          throw conflict("The idempotent payment request is still being processed")
        }
      }

      await this.validateContext(transaction, context, data.customerId, data.depositToAccountId)
      const amount = formatMoney(asMoney(data.amount, "Payment amount"))
      const paymentNumber = await this.nextNumber(transaction, context.companyId)
      const now = new Date()
      await transaction.insert(customerPayments).values({
        id,
        companyId: context.companyId,
        branchId: context.branchId,
        customerId: data.customerId,
        paymentNumber,
        paymentDate: new Date(`${data.paymentDate}T00:00:00.000Z`),
        currency: data.currency,
        exchangeRate: data.exchangeRate,
        amount,
        unappliedAmount: amount,
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        depositAccountId: data.depositToAccountId,
        status: "draft",
        createdBy: context.principal.userId,
        updatedBy: context.principal.userId,
        createdAt: now,
        updatedAt: now,
      })
      if (data.allocations.length)
        await this.replaceAllocationsInTransaction(transaction, context, id, data.allocations)
      await this.audit(transaction, context, "create", id, { after: { status: "draft", amount } })
      const created = await this.read(transaction, context, id)
      if (!created) throw conflict("Customer payment could not be read after creation")
      return created
    })
  }

  async update(
    context: RequestContext,
    id: string,
    data: CustomerPaymentUpdateData,
    version?: number,
  ) {
    return this.db.transaction(async (transaction) => {
      const current = await this.requireDraft(transaction, context, id)
      if (version !== undefined && version !== current.version)
        throw conflict("Payment was changed by another user. Refresh and try again.")
      const merged = {
        customerId: data.customerId ?? current.customerId,
        paymentDate: data.paymentDate ?? dateText(current.paymentDate),
        amount: formatMoney(asMoney(data.amount ?? current.amount, "Payment amount")),
        currency: data.currency ?? current.currency,
        exchangeRate: data.exchangeRate ?? current.exchangeRate,
        depositToAccountId: data.depositToAccountId ?? current.depositAccountId,
        paymentMethod: data.paymentMethod ?? current.paymentMethod,
        reference: data.reference ?? current.reference,
      }
      if (!merged.depositToAccountId)
        throw validation("A deposit account is required before this draft can be updated")
      if (!merged.paymentMethod)
        throw validation("A payment method is required before this draft can be updated")
      await this.validateContext(
        transaction,
        context,
        merged.customerId,
        merged.depositToAccountId,
      )
      const existingAllocations = await transaction
        .select({ invoiceId: customerPaymentAllocations.invoiceId, amount: customerPaymentAllocations.amount })
        .from(customerPaymentAllocations)
        .where(eq(customerPaymentAllocations.paymentId, id))
      await this.validateAllocations(
        transaction,
        context,
        { ...current, customerId: merged.customerId, amount: merged.amount },
        existingAllocations,
      )
      const allocationTotal = existingAllocations.reduce(
        (total, allocation) => addMoney(total, asMoney(allocation.amount, "Allocation amount")),
        parseMoney("0"),
      )
      const unapplied = formatMoney(subtractMoney(parseMoney(merged.amount), allocationTotal))
      const [updated] = await transaction.update(customerPayments).set({
        customerId: merged.customerId,
        paymentDate: new Date(`${merged.paymentDate}T00:00:00.000Z`),
        amount: merged.amount,
        currency: merged.currency,
        exchangeRate: merged.exchangeRate,
        depositAccountId: merged.depositToAccountId,
        paymentMethod: merged.paymentMethod,
        reference: merged.reference,
        unappliedAmount: unapplied,
        version: current.version + 1,
        updatedBy: context.principal.userId,
        updatedAt: new Date(),
      }).where(and(
        eq(customerPayments.id, id),
        eq(customerPayments.companyId, context.companyId),
        eq(customerPayments.branchId, context.branchId),
        eq(customerPayments.status, "draft"),
        eq(customerPayments.version, current.version),
      )).returning({ id: customerPayments.id })
      if (!updated) throw conflict("Payment changed before it could be updated")
      await this.audit(transaction, context, "update", id, { before: { version: current.version }, after: { version: current.version + 1 } })
      const result = await this.read(transaction, context, id)
      if (!result) throw notFound("Customer payment was not found")
      return result
    })
  }

  replaceAllocations(
    context: RequestContext,
    id: string,
    allocations: PaymentAllocationInput[],
  ) {
    return this.db.transaction(async (transaction) =>
      this.replaceAllocationsInTransaction(transaction, context, id, allocations))
  }

  post(context: RequestContext, id: string, idempotencyKey: string) {
    return this.db.transaction(async (transaction) => {
      const payment = await this.requirePayment(transaction, context, id)
      if (payment.status === "posted") {
        const existing = await this.findPosting(transaction, context.companyId, id)
        if (existing?.idempotencyKey === idempotencyKey) {
          const record = await this.read(transaction, context, id)
          if (record) return record
        }
        throw conflict("Customer payment is already posted with a different request")
      }
      if (payment.status !== "draft")
        throw conflict("Only a draft customer payment can be posted")
      if (!payment.depositAccountId)
        throw validation("A valid deposit account is required before this payment can be posted")
      if (compareMoney(asMoney(payment.amount, "Payment amount"), parseMoney("0")) <= 0)
        throw validation("Payment amount must be greater than zero")

      const customer = await this.validateContext(
        transaction,
        context,
        payment.customerId,
        payment.depositAccountId,
      )
      const allocations = await transaction.select({
        invoiceId: customerPaymentAllocations.invoiceId,
        amount: customerPaymentAllocations.amount,
      }).from(customerPaymentAllocations)
        .where(eq(customerPaymentAllocations.paymentId, id))
        .orderBy(asc(customerPaymentAllocations.createdAt))
      await this.validateAllocations(transaction, context, payment, allocations, false)

      const allocationTotal = allocations.reduce(
        (total, allocation) => addMoney(total, asMoney(allocation.amount, "Allocation amount")),
        parseMoney("0"),
      )
      const unappliedAmount = formatMoney(
        subtractMoney(parseMoney(payment.amount), allocationTotal),
      )
      for (const allocation of allocations) {
        const [invoice] = await transaction.select().from(invoices).where(and(
          eq(invoices.id, allocation.invoiceId),
          eq(invoices.companyId, context.companyId),
        )).for("update").limit(1)
        if (!invoice) throw validation("Allocation invoice was not found for this company")
        const [postedAllocation] = await transaction.select({
          total: sql<string>`coalesce(sum(${customerPaymentAllocations.amount}), 0)::text`,
        }).from(customerPaymentAllocations)
          .innerJoin(customerPayments, eq(customerPaymentAllocations.paymentId, customerPayments.id))
          .where(and(
            eq(customerPaymentAllocations.invoiceId, invoice.id),
            eq(customerPayments.companyId, context.companyId),
            eq(customerPayments.status, "posted"),
            eq(customerPayments.isDeleted, false),
          ))
        const amountPaidMoney = addMoney(
          asMoney(postedAllocation?.total ?? "0", "Posted allocation total"),
          asMoney(allocation.amount, "Allocation amount"),
        )
        const amountPaid = formatMoney(amountPaidMoney)
        const balanceDueMoney = subtractMoney(
          parseMoney(invoice.total),
          amountPaidMoney,
        )
        if (compareMoney(balanceDueMoney, parseMoney("0")) < 0)
          throw validation(`Payment exceeds invoice ${invoice.invoiceNumber}'s open amount`)
        const balanceDue = formatMoney(balanceDueMoney)
        const status = compareMoney(balanceDueMoney, parseMoney("0")) === 0
          ? "paid"
          : "partially_paid"
        const [settled] = await transaction.update(invoices).set({
          amountPaid,
          balanceDue,
          status,
          version: invoice.version + 1,
          updatedBy: context.principal.userId,
          updatedAt: new Date(),
        }).where(and(
          eq(invoices.id, invoice.id),
          eq(invoices.companyId, context.companyId),
          eq(invoices.version, invoice.version),
        )).returning({ id: invoices.id })
        if (!settled) throw conflict("Invoice settlement changed concurrently")
      }

      await this.ledger.postInTransaction(
        transaction,
        context,
        buildCustomerPaymentPosting({
          paymentId: payment.id,
          paymentNumber: payment.paymentNumber,
          paymentDate: dateText(payment.paymentDate),
          sourceVersion: payment.version,
          currency: payment.currency,
          exchangeRate: payment.exchangeRate,
          amount: payment.amount,
          depositAccountId: payment.depositAccountId,
          customerName: customer.displayName,
          receivableAccountId: customer.receivableAccountId ?? undefined,
          idempotencyKey,
        }),
      )

      const [posted] = await transaction.update(customerPayments).set({
        status: "posted",
        unappliedAmount,
        version: payment.version + 1,
        updatedBy: context.principal.userId,
        updatedAt: new Date(),
      }).where(and(
        eq(customerPayments.id, id),
        eq(customerPayments.companyId, context.companyId),
        eq(customerPayments.branchId, context.branchId),
        eq(customerPayments.status, "draft"),
        eq(customerPayments.version, payment.version),
      )).returning({ id: customerPayments.id })
      if (!posted) throw conflict("Payment changed before it could be posted")
      await this.audit(transaction, context, "post", id, {
        before: { status: "draft" },
        after: {
          status: "posted",
          amount: payment.amount,
          allocatedAmount: formatMoney(allocationTotal),
          unappliedAmount,
        },
      })
      const result = await this.read(transaction, context, id)
      if (!result) throw notFound("Posted customer payment was not found")
      return result
    })
  }

  async remove(context: RequestContext, id: string) {
    await this.db.transaction(async (transaction) => {
      const current = await this.requireDraft(transaction, context, id)
      const now = new Date()
      const [deleted] = await transaction.update(customerPayments).set({
        isDeleted: true,
        deletedAt: now,
        version: current.version + 1,
        updatedBy: context.principal.userId,
        updatedAt: now,
      }).where(and(
        eq(customerPayments.id, id),
        eq(customerPayments.companyId, context.companyId),
        eq(customerPayments.branchId, context.branchId),
        eq(customerPayments.status, "draft"),
        eq(customerPayments.version, current.version),
      )).returning({ id: customerPayments.id })
      if (!deleted) throw conflict("Payment changed before it could be deleted")
      await this.audit(transaction, context, "delete", id, { before: { status: "draft" } })
    })
  }

  private async replaceAllocationsInTransaction(
    transaction: DatabaseTransaction,
    context: RequestContext,
    id: string,
    allocations: PaymentAllocationInput[],
  ) {
    const payment = await this.requireDraft(transaction, context, id)
    await this.validateAllocations(transaction, context, payment, allocations)
    const total = allocations.reduce(
      (sum, allocation) => addMoney(sum, asMoney(allocation.amount, "Allocation amount")),
      parseMoney("0"),
    )
    const unapplied = formatMoney(subtractMoney(parseMoney(payment.amount), total))
    await transaction.delete(customerPaymentAllocations)
      .where(eq(customerPaymentAllocations.paymentId, id))
    if (allocations.length)
      await transaction.insert(customerPaymentAllocations).values(
        allocations.map((allocation) => ({
          paymentId: id,
          invoiceId: allocation.invoiceId,
          amount: formatMoney(asMoney(allocation.amount, "Allocation amount")),
        })),
      )
    await transaction.update(customerPayments).set({
      unappliedAmount: unapplied,
      version: payment.version + 1,
      updatedBy: context.principal.userId,
      updatedAt: new Date(),
    }).where(and(
      eq(customerPayments.id, id),
      eq(customerPayments.status, "draft"),
      eq(customerPayments.version, payment.version),
    ))
    await this.audit(transaction, context, "allocate-draft", id, {
      after: { allocationCount: allocations.length, unappliedAmount: unapplied },
    })
    const result = await this.read(transaction, context, id)
    if (!result) throw notFound("Customer payment was not found")
    return result
  }

  private async validateAllocations(
    transaction: DatabaseTransaction,
    context: RequestContext,
    payment: PaymentRow,
    allocations: PaymentAllocationInput[],
    includeDraftReservations = true,
  ) {
    const total = allocations.reduce((sum, allocation) => {
      const amount = asMoney(allocation.amount, "Allocation amount")
      if (compareMoney(amount, parseMoney("0")) <= 0)
        throw validation("Allocation amount must be greater than zero")
      return addMoney(sum, amount)
    }, parseMoney("0"))
    if (compareMoney(total, parseMoney(payment.amount)) > 0)
      throw validation("Payment allocations cannot exceed the payment amount")
    if (!allocations.length) return

    const ids = allocations.map((allocation) => allocation.invoiceId)
    if (new Set(ids).size !== ids.length)
      throw validation("An invoice can appear only once per payment")
    const rows = await transaction.select().from(invoices).where(inArray(invoices.id, ids)).for("update")
    const byId = new Map(rows.map((invoice) => [invoice.id, invoice]))
    for (const allocation of allocations) {
      const invoice = byId.get(allocation.invoiceId)
      if (!invoice || invoice.companyId !== context.companyId)
        throw validation("Allocation invoice was not found for this company")
      if (invoice.customerId !== payment.customerId)
        throw validation("Payment and invoice must belong to the same customer")
      if (!["open", "partially_paid", "overdue"].includes(invoice.status))
        throw validation("Only an open posted invoice can receive an allocation")
      const [reserved] = includeDraftReservations
        ? await transaction.select({
            total: sql<string>`coalesce(sum(${customerPaymentAllocations.amount}), 0)::text`,
          }).from(customerPaymentAllocations)
          .innerJoin(customerPayments, eq(customerPaymentAllocations.paymentId, customerPayments.id))
          .where(and(
            eq(customerPaymentAllocations.invoiceId, invoice.id),
            ne(customerPaymentAllocations.paymentId, payment.id),
            eq(customerPayments.companyId, context.companyId),
            eq(customerPayments.status, "draft"),
            eq(customerPayments.isDeleted, false),
          ))
        : [{ total: "0" }]
      const requested = asMoney(allocation.amount, "Allocation amount")
      const projected = addMoney(asMoney(reserved?.total ?? "0", "Reserved allocation"), requested)
      if (compareMoney(projected, parseMoney(invoice.balanceDue)) > 0)
        throw validation(`Allocations cannot exceed invoice ${invoice.invoiceNumber}'s open amount`)
    }
  }

  private async validateContext(
    transaction: DatabaseTransaction,
    context: RequestContext,
    customerId: string,
    depositAccountId: string,
  ) {
    const [[company], [branch], [customer], [account]] = await Promise.all([
      transaction.select({ currency: companies.functionalCurrency }).from(companies)
        .where(and(eq(companies.id, context.companyId), eq(companies.active, true))).limit(1),
      transaction.select({ id: branches.id }).from(branches).where(and(
        eq(branches.id, context.branchId), eq(branches.companyId, context.companyId), eq(branches.active, true),
      )).limit(1),
      transaction.select({
        id: customers.id,
        displayName: customers.displayName,
        receivableAccountId: customers.receivableAccountId,
      }).from(customers).where(and(
        eq(customers.id, customerId), eq(customers.companyId, context.companyId),
        eq(customers.active, true), eq(customers.isDeleted, false),
      )).limit(1),
      transaction.select({ id: accounts.id }).from(accounts).where(and(
        eq(accounts.id, depositAccountId), eq(accounts.companyId, context.companyId), eq(accounts.active, true),
      )).limit(1),
    ])
    if (!company) throw notFound("Company was not found")
    if (!branch) throw validation("The selected branch is not active for this company")
    if (!customer) throw validation("The selected customer is not active for this company")
    if (!account) throw validation("The deposit account is not active for this company")
    return customer
  }

  private async requireDraft(
    transaction: DatabaseTransaction,
    context: RequestContext,
    id: string,
  ) {
    const payment = await this.requirePayment(transaction, context, id)
    if (payment.status !== "draft")
      throw conflict("Posted or reversed payments are immutable")
    return payment
  }

  private async requirePayment(
    transaction: DatabaseTransaction,
    context: RequestContext,
    id: string,
  ) {
    const [payment] = await transaction.select().from(customerPayments).where(and(
      eq(customerPayments.id, id),
      eq(customerPayments.companyId, context.companyId),
      eq(customerPayments.branchId, context.branchId),
      eq(customerPayments.isDeleted, false),
      isNull(customerPayments.deletedAt),
    )).for("update").limit(1)
    if (!payment) throw notFound("Customer payment was not found")
    return payment
  }

  private async findPosting(
    executor: Executor,
    companyId: string,
    paymentId: string,
  ) {
    const [posting] = await executor.select({
      id: accountingTransactions.id,
      idempotencyKey: accountingTransactions.idempotencyKey,
    }).from(accountingTransactions).where(and(
      eq(accountingTransactions.companyId, companyId),
      eq(accountingTransactions.sourceModule, "sales"),
      eq(accountingTransactions.sourceType, "customer_payment"),
      eq(accountingTransactions.sourceId, paymentId),
      eq(accountingTransactions.postingKind, "primary"),
    )).limit(1)
    return posting
  }

  private async read(executor: Executor, context: RequestContext, id: string) {
    const [row] = await executor.select({ payment: customerPayments, customerName: customers.displayName })
      .from(customerPayments)
      .innerJoin(customers, eq(customerPayments.customerId, customers.id))
      .where(and(
        eq(customerPayments.id, id),
        eq(customerPayments.companyId, context.companyId),
        eq(customerPayments.branchId, context.branchId),
        eq(customerPayments.isDeleted, false),
        isNull(customerPayments.deletedAt),
      )).limit(1)
    return row ? this.project(executor, row.payment, row.customerName) : undefined
  }

  private async project(executor: Executor, row: PaymentRow, customerName: string): Promise<ResourceRecord> {
    const allocations = await executor.select({
      invoiceId: customerPaymentAllocations.invoiceId,
      amount: customerPaymentAllocations.amount,
    }).from(customerPaymentAllocations)
      .where(eq(customerPaymentAllocations.paymentId, row.id))
      .orderBy(asc(customerPaymentAllocations.createdAt))
    return {
      id: row.id,
      module: "sales",
      resource: "payments",
      companyId: row.companyId,
      branchId: row.branchId,
      status: row.status,
      version: row.version,
      data: {
        customerId: row.customerId,
        customerName,
        documentNumber: row.paymentNumber,
        paymentDate: dateText(row.paymentDate),
        currency: row.currency,
        exchangeRate: row.exchangeRate,
        amount: row.amount,
        unappliedAmount: row.unappliedAmount,
        paymentMethod: row.paymentMethod ?? undefined,
        reference: row.reference ?? undefined,
        depositToAccountId: row.depositAccountId ?? undefined,
        requiresDepositAccount: !row.depositAccountId,
        allocations,
      },
      createdAt: row.createdAt.toISOString(),
      createdBy: row.createdBy,
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy,
      isDeleted: row.isDeleted,
      deletedAt: row.deletedAt?.toISOString(),
    }
  }

  private async nextNumber(transaction: DatabaseTransaction, companyId: string) {
    const documentType = "sales/payments"
    await transaction.insert(documentSequences).values({
      companyId, documentType, prefix: "PAY-", nextNumber: 1, padding: 5,
    }).onConflictDoNothing()
    const [sequence] = await transaction.update(documentSequences).set({
      nextNumber: sql`${documentSequences.nextNumber} + 1`, updatedAt: new Date(),
    }).where(and(
      eq(documentSequences.companyId, companyId),
      eq(documentSequences.documentType, documentType),
    )).returning()
    return `${sequence.prefix}${String(sequence.nextNumber - 1).padStart(sequence.padding, "0")}`
  }

  private audit(
    transaction: DatabaseTransaction,
    context: RequestContext,
    action: string,
    paymentId: string,
    changes: Record<string, unknown>,
  ) {
    return transaction.insert(auditEvents).values({
      id: randomUUID(),
      requestId: context.requestId,
      companyId: context.companyId,
      branchId: context.branchId,
      userId: context.principal.userId,
      action,
      entityType: "sales/payments",
      entityId: paymentId,
      changes,
    })
  }
}
