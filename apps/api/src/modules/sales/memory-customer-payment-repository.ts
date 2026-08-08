import { randomUUID } from "node:crypto"
import type {
  CustomerPaymentCreateData,
  CustomerPaymentReverseInput,
  CustomerPaymentUpdateData,
} from "@blue-plastic/types"
import { addMoney, compareMoney, formatMoney, parseMoney, subtractMoney } from "../accounting/money.js"
import { conflict, notFound, validation } from "../../platform/errors.js"
import type { ListQuery, RequestContext, ResourceRecord } from "../../platform/types.js"
import type { ResourceRepository } from "../../repositories/resource-repository.js"
import type { MemoryLedgerRepository } from "../accounting/memory-ledger-repository.js"
import type { MemoryInvoiceRepository } from "./memory-invoice-repository.js"
import type {
  CustomerPaymentCreateOptions,
  CustomerPaymentRepository,
  PaymentAllocationInput,
} from "./customer-payment-repository.js"
import { buildCustomerPaymentPosting } from "./customer-payment-posting.js"

const money = (value: string) => {
  try { return parseMoney(value) }
  catch { throw validation("Financial amounts support at most 4 decimal places") }
}

export class MemoryCustomerPaymentRepository implements CustomerPaymentRepository {
  private records: ResourceRecord[] = []
  private idempotency = new Map<string, { hash: string; id: string }>()
  private nextNumber = 1

  constructor(
    private readonly resources: ResourceRepository,
    private readonly invoices: MemoryInvoiceRepository,
    private readonly ledger: MemoryLedgerRepository,
  ) {}

  async list(context: RequestContext, query: ListQuery) {
    const filtered = this.records.filter((record) =>
      record.companyId === context.companyId &&
      record.branchId === context.branchId &&
      !record.isDeleted &&
      (!query.status || record.status === query.status) &&
      (!query.search || JSON.stringify(record.data).toLowerCase().includes(query.search.toLowerCase())))
    const ordered = [...filtered].sort((left, right) =>
      (query.order === "asc" ? 1 : -1) * left.createdAt.localeCompare(right.createdAt))
    return {
      data: ordered.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
      total: filtered.length,
    }
  }

  async findById(context: RequestContext, id: string) {
    return this.records.find((record) =>
      record.id === id && record.companyId === context.companyId &&
      record.branchId === context.branchId && !record.isDeleted)
  }

  async create(
    context: RequestContext,
    data: CustomerPaymentCreateData,
    options: CustomerPaymentCreateOptions = {},
  ) {
    if (options.idempotencyKey) {
      if (!options.requestHash) throw validation("An idempotency request hash is required")
      const known = this.idempotency.get(`${context.companyId}:${options.idempotencyKey}`)
      if (known) {
        if (known.hash !== options.requestHash)
          throw conflict("Idempotency key was already used with a different request")
        const existing = await this.findById(context, known.id)
        if (existing) return existing
      }
    }
    await this.validateReferences(context, data.customerId, data.depositToAccountId)
    const amount = formatMoney(money(data.amount))
    const now = new Date().toISOString()
    const record: ResourceRecord = {
      id: randomUUID(), module: "sales", resource: "payments",
      companyId: context.companyId, branchId: context.branchId,
      status: "draft", version: 1,
      data: {
        customerId: data.customerId,
        documentNumber: `PAY-${String(this.nextNumber++).padStart(5, "0")}`,
        paymentDate: data.paymentDate,
        currency: data.currency,
        exchangeRate: data.exchangeRate,
        amount,
        unappliedAmount: amount,
        paymentMethod: data.paymentMethod,
        reference: data.reference,
        depositToAccountId: data.depositToAccountId,
        requiresDepositAccount: false,
        allocations: [],
      },
      createdAt: now, createdBy: context.principal.userId,
      updatedAt: now, updatedBy: context.principal.userId, isDeleted: false,
    }
    this.records.push(record)
    if (data.allocations.length)
      await this.replaceAllocations(context, record.id, data.allocations)
    if (options.idempotencyKey && options.requestHash)
      this.idempotency.set(`${context.companyId}:${options.idempotencyKey}`, {
        hash: options.requestHash, id: record.id,
      })
    return (await this.findById(context, record.id))!
  }

  async update(
    context: RequestContext,
    id: string,
    data: CustomerPaymentUpdateData,
    version?: number,
  ) {
    const current = await this.requireDraft(context, id)
    if (version !== undefined && version !== current.version)
      throw conflict("Payment was changed by another user. Refresh and try again.")
    const customerId = data.customerId ?? String(current.data.customerId)
    const depositToAccountId = data.depositToAccountId ?? String(current.data.depositToAccountId ?? "")
    if (!depositToAccountId) throw validation("A deposit account is required before this draft can be updated")
    await this.validateReferences(context, customerId, depositToAccountId)
    const amount = formatMoney(money(data.amount ?? String(current.data.amount)))
    const allocations = current.data.allocations as PaymentAllocationInput[]
    await this.validateAllocations(context, current.id, customerId, amount, allocations)
    const total = allocations.reduce((sum, allocation) => addMoney(sum, money(allocation.amount)), parseMoney("0"))
    current.data = {
      ...current.data,
      ...data,
      customerId,
      depositToAccountId,
      amount,
      unappliedAmount: formatMoney(subtractMoney(parseMoney(amount), total)),
      requiresDepositAccount: false,
    }
    current.version += 1
    current.updatedAt = new Date().toISOString()
    current.updatedBy = context.principal.userId
    return current
  }

  async replaceAllocations(
    context: RequestContext,
    id: string,
    allocations: PaymentAllocationInput[],
  ) {
    const payment = await this.requireDraft(context, id)
    await this.validateAllocations(
      context, id, String(payment.data.customerId), String(payment.data.amount), allocations,
    )
    const normalized = allocations.map((allocation) => ({
      invoiceId: allocation.invoiceId,
      amount: formatMoney(money(allocation.amount)),
    }))
    const total = normalized.reduce((sum, allocation) => addMoney(sum, parseMoney(allocation.amount)), parseMoney("0"))
    payment.data = {
      ...payment.data,
      allocations: normalized,
      unappliedAmount: formatMoney(subtractMoney(parseMoney(String(payment.data.amount)), total)),
    }
    payment.version += 1
    payment.updatedAt = new Date().toISOString()
    payment.updatedBy = context.principal.userId
    return payment
  }

  async post(context: RequestContext, id: string, idempotencyKey: string) {
    const payment = await this.findById(context, id)
    if (!payment) throw notFound("Customer payment was not found")
    if (payment.status === "posted") {
      if (payment.data.postingIdempotencyKey === idempotencyKey) return payment
      throw conflict("Customer payment is already posted with a different request")
    }
    if (payment.status !== "draft")
      throw conflict("Only a draft customer payment can be posted")
    const depositAccountId = String(payment.data.depositToAccountId ?? "")
    if (!depositAccountId)
      throw validation("A valid deposit account is required before this payment can be posted")
    await this.validateReferences(context, String(payment.data.customerId), depositAccountId)
    const allocations = payment.data.allocations as PaymentAllocationInput[]
    await this.validateAllocations(
      context,
      payment.id,
      String(payment.data.customerId),
      String(payment.data.amount),
      allocations,
    )
    const customer = await this.resources.findById(
      { companyId: context.companyId, module: "sales", resource: "customers" },
      String(payment.data.customerId),
    )
    if (!customer) throw validation("The selected customer is not active for this company")
    const restoreLedger = this.ledger.snapshot()
    const restoreInvoices = this.invoices.snapshotPaymentSettlement(
      allocations.map((allocation) => allocation.invoiceId),
    )
    const snapshot = { ...payment, data: { ...payment.data } }
    try {
      for (const allocation of allocations)
        this.invoices.applyPaymentSettlement(context, allocation.invoiceId, allocation.amount)
      await this.ledger.post(context, buildCustomerPaymentPosting({
        paymentId: payment.id,
        paymentNumber: String(payment.data.documentNumber),
        paymentDate: String(payment.data.paymentDate),
        sourceVersion: payment.version,
        currency: String(payment.data.currency),
        exchangeRate: String(payment.data.exchangeRate ?? "1"),
        amount: String(payment.data.amount),
        depositAccountId,
        customerName: String(customer.data.displayName ?? "Customer"),
        receivableAccountId:
          typeof customer.data.receivableAccountId === "string"
            ? customer.data.receivableAccountId
            : undefined,
        idempotencyKey,
      }))
      payment.status = "posted"
      payment.version += 1
      payment.updatedAt = new Date().toISOString()
      payment.updatedBy = context.principal.userId
      payment.data = { ...payment.data, postingIdempotencyKey: idempotencyKey }
      return payment
    } catch (error) {
      restoreLedger()
      restoreInvoices()
      Object.assign(payment, snapshot, { data: snapshot.data })
      throw error
    }
  }

  async reverse(
    context: RequestContext,
    id: string,
    input: CustomerPaymentReverseInput,
    idempotencyKey: string,
  ) {
    const payment = await this.findById(context, id)
    if (!payment) throw notFound("Customer payment was not found")
    if (payment.status === "reversed") {
      if (payment.data.reversalIdempotencyKey === idempotencyKey) return payment
      throw conflict("Customer payment is already reversed with a different request")
    }
    if (payment.status !== "posted")
      throw conflict("Only a posted customer payment can be reversed")
    const original = this.ledger.findPosting(context.companyId, {
      sourceModule: "sales",
      sourceType: "customer_payment",
      sourceId: id,
    })
    if (!original)
      throw notFound("A posted GL transaction for this customer payment was not found")

    const allocations = payment.data.allocations as PaymentAllocationInput[]
    const restoreLedger = this.ledger.snapshot()
    const restoreInvoices = this.invoices.snapshotPaymentSettlement(
      allocations.map((allocation) => allocation.invoiceId),
    )
    const snapshot = { ...payment, data: { ...payment.data } }
    try {
      const reversalDate = input.reversalDate ?? new Date().toISOString().slice(0, 10)
      await this.ledger.reverseTransaction(context, {
        sourceModule: "sales",
        sourceType: "customer_payment",
        sourceId: id,
        reversalDate,
        idempotencyKey,
        memo: input.reason ?? `Reversal of customer payment ${String(payment.data.documentNumber)}`,
      })
      payment.status = "reversed"
      payment.version += 1
      payment.updatedAt = new Date().toISOString()
      payment.updatedBy = context.principal.userId
      payment.data = {
        ...payment.data,
        reversalIdempotencyKey: idempotencyKey,
      }

      const invoiceIds = [...new Set(allocations.map((allocation) => allocation.invoiceId))]
      for (const invoiceId of invoiceIds) {
        const remaining = this.records
          .filter((record) =>
            record.companyId === context.companyId &&
            record.status === "posted" &&
            !record.isDeleted)
          .flatMap((record) => record.data.allocations as PaymentAllocationInput[])
          .filter((allocation) => allocation.invoiceId === invoiceId)
          .reduce(
            (total, allocation) => addMoney(total, money(allocation.amount)),
            parseMoney("0"),
          )
        this.invoices.applyCanonicalSettlement(context, invoiceId, formatMoney(remaining))
      }
      return payment
    } catch (error) {
      restoreLedger()
      restoreInvoices()
      Object.assign(payment, snapshot, { data: snapshot.data })
      throw error
    }
  }

  async remove(context: RequestContext, id: string) {
    const payment = await this.requireDraft(context, id)
    payment.isDeleted = true
    payment.deletedAt = new Date().toISOString()
    payment.version += 1
    payment.updatedBy = context.principal.userId
  }

  private async requireDraft(context: RequestContext, id: string) {
    const payment = await this.findById(context, id)
    if (!payment) throw notFound("Customer payment was not found")
    if (payment.status !== "draft") throw conflict("Posted or reversed payments are immutable")
    return payment
  }

  private async validateReferences(context: RequestContext, customerId: string, accountId: string) {
    const [customer, account] = await Promise.all([
      this.resources.findById({ companyId: context.companyId, module: "sales", resource: "customers" }, customerId),
      this.resources.findById({ companyId: context.companyId, module: "accounting", resource: "chart-of-accounts" }, accountId),
    ])
    if (!customer || customer.status === "inactive")
      throw validation("The selected customer is not active for this company")
    if (!account || account.status === "inactive")
      throw validation("The deposit account is not active for this company")
  }

  private async validateAllocations(
    context: RequestContext,
    paymentId: string,
    customerId: string,
    paymentAmount: string,
    allocations: PaymentAllocationInput[],
  ) {
    if (new Set(allocations.map((allocation) => allocation.invoiceId)).size !== allocations.length)
      throw validation("An invoice can appear only once per payment")
    const total = allocations.reduce((sum, allocation) => {
      const amount = money(allocation.amount)
      if (compareMoney(amount, parseMoney("0")) <= 0)
        throw validation("Allocation amount must be greater than zero")
      return addMoney(sum, amount)
    }, parseMoney("0"))
    if (compareMoney(total, parseMoney(paymentAmount)) > 0)
      throw validation("Payment allocations cannot exceed the payment amount")
    for (const allocation of allocations) {
      const invoice = await this.invoices.findById(context, allocation.invoiceId)
      if (!invoice) throw validation("Allocation invoice was not found for this company")
      if (String(invoice.data.customerId) !== customerId)
        throw validation("Payment and invoice must belong to the same customer")
      if (!["open", "partially_paid", "overdue"].includes(invoice.status))
        throw validation("Only an open posted invoice can receive an allocation")
      const reserved = this.records.filter((record) =>
        record.id !== paymentId && record.companyId === context.companyId &&
        record.status === "draft" && !record.isDeleted)
        .flatMap((record) => record.data.allocations as PaymentAllocationInput[])
        .filter((candidate) => candidate.invoiceId === allocation.invoiceId)
        .reduce((sum, candidate) => addMoney(sum, money(candidate.amount)), parseMoney("0"))
      if (compareMoney(addMoney(reserved, money(allocation.amount)), parseMoney(String(invoice.data.balanceDue))) > 0)
        throw validation(`Allocations cannot exceed invoice ${String(invoice.data.documentNumber)}'s open amount`)
    }
  }
}
