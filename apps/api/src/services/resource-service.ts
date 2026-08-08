import { randomUUID } from "node:crypto"
import {
  isMvpResource,
  type InvoiceCreateData,
  type InvoiceUpdateData,
} from "@blue-plastic/types"
import { getResourceDefinition } from "../domain/modules.js"
import type { RecordEnricher } from "../modules/read-models/record-read-model.js"
import type { InventoryOpeningPort } from "../modules/inventory/inventory-movement-port.js"
import type { LedgerRepository } from "../modules/accounting/ledger-repository.js"
import { systemAccountKeys } from "../modules/accounting/system-accounts.js"
import { createBalancedJournalEntry } from "../modules/accounting/posting-engine.js"
import { conflict, notFound, validation } from "../platform/errors.js"
import type {
  ListQuery,
  RequestContext,
  ResourceRecord,
  TrashQuery,
} from "../platform/types.js"
import type { ResourceRepository } from "../repositories/resource-repository.js"
import type { InvoiceRepository } from "../modules/sales/invoice-repository.js"
import type { CustomerPaymentService } from "../modules/sales/customer-payment-service.js"
import { validateOperationalData } from "../modules/operations/operational-validation.js"
import { assertBalanced } from "../modules/accounting/ledger-math.js"

interface WriteInput {
  status?: string
  data: Record<string, unknown>
  version?: number
}

interface IdempotencyInput {
  key: string
  requestHash: string
}

const documentPrefixes: Record<string, string> = {
  "sales/estimates": "EST-",
  "sales/sales-orders": "SO-",
  "sales/invoices": "INV-",
  "sales/payments": "PAY-",
  "sales/credit-notes": "CN-",
  "sales/sales-receipts": "SR-",
  "sales/refund-receipts": "RR-",
  "sales/deposits": "DEP-",
  "purchasing/purchase-orders": "PO-",
  "purchasing/receipts": "REC-",
  "purchasing/bills": "BILL-",
  "purchasing/bill-payments": "BP-",
  "purchasing/vendor-credits": "VC-",
  "purchasing/expenses": "EXP-",
  "purchasing/checks": "CHK-",
  "inventory/transfers": "IT-",
  "inventory/adjustments": "ADJ-",
  "inventory/stock-counts": "SC-",
  "inventory/assemblies": "ASM-",
  "banking/deposits": "BD-",
  "banking/transfers": "BT-",
  "banking/checks": "BCHK-",
  "banking/reconciliation": "RECON-",
}

const protectedWorkflowStatuses = new Set([
  "approved",
  "posted",
  "paid",
  "received",
  "allocated",
  "picked",
  "packed",
  "shipped",
  "matched",
  "added",
  "excluded",
  "reconciled",
])

function validateRequired(
  moduleName: string,
  resourceName: string,
  data: Record<string, unknown>,
) {
  const definition = getResourceDefinition(moduleName, resourceName)
  if (!definition)
    throw notFound(`Unknown API resource: ${moduleName}/${resourceName}`)
  const missing = definition.requiredFields.filter((field) => {
    const value = data[field]
    return (
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0)
    )
  })
  if (missing.length)
    throw validation("Required fields are missing", { fields: missing })
}

function validateJournalBalance(
  moduleName: string,
  resourceName: string,
  data: Record<string, unknown>,
) {
  if (moduleName !== "accounting" || resourceName !== "journal-entries") return
  const lines = data.lines
  if (!Array.isArray(lines) || lines.length < 2)
    throw validation("A journal entry requires at least two lines")
  try {
    assertBalanced(lines as Array<Record<string, unknown>>)
  } catch (error) {
    throw validation(error instanceof Error ? error.message : "Journal entry is not balanced")
  }
}

/** Resources that have been normalized out of the generic JSONB store. */
function isRelationalResource(moduleName: string, resourceName: string) {
  return moduleName === "sales" && resourceName === "invoices"
}

/**
 * Resources outside the MVP answer as if they do not exist. Their definitions,
 * contracts and tables are untouched; only the door is closed.
 */
function requireMvpResource(moduleName: string, resourceName: string) {
  if (!getResourceDefinition(moduleName, resourceName))
    throw notFound(`Unknown API resource: ${moduleName}/${resourceName}`)
  if (!isMvpResource(moduleName, resourceName))
    throw notFound(`${moduleName}/${resourceName} is outside the MVP scope`)
}

export class ResourceService {
  /**
   * Callers that still speak the generic resource language — conversions,
   * progress billing, reports — are delegated to the normalized invoice
   * repository so invoices keep exactly one source of truth.
   */
  constructor(
    private readonly repository: ResourceRepository,
    private readonly invoices?: InvoiceRepository,
    private readonly enricher?: RecordEnricher,
    private readonly inventory?: InventoryOpeningPort,
    private readonly ledger?: LedgerRepository,
    private readonly payments?: CustomerPaymentService,
  ) {}

  validateData(
    moduleName: string,
    resourceName: string,
    input: Record<string, unknown>,
    status = "draft",
  ) {
    requireMvpResource(moduleName, resourceName)
    const partial = status.toLowerCase() === "incomplete"
    const data = validateOperationalData(moduleName, resourceName, input, { partial })
    if (!partial) {
      validateRequired(moduleName, resourceName, data)
      validateJournalBalance(moduleName, resourceName, data)
    }
    return data
  }

  async list(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    query: ListQuery,
  ) {
    requireMvpResource(moduleName, resourceName)
    const result =
      this.payments && moduleName === "sales" && resourceName === "payments"
        ? await this.payments.list(context, query)
        : this.invoices && moduleName === "sales" && resourceName === "invoices"
        ? await this.invoices.list(context, query)
        : await this.repository.list(
            {
              companyId: context.companyId,
              branchId: context.branchId,
              module: moduleName,
              resource: resourceName,
            },
            query,
          )
    if (!this.enricher) return result
    return {
      ...result,
      data: await this.enricher.enrich(
        context,
        moduleName,
        resourceName,
        result.data,
      ),
    }
  }

  async get(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    id: string,
  ) {
    requireMvpResource(moduleName, resourceName)
    const record =
      this.payments && moduleName === "sales" && resourceName === "payments"
        ? await this.payments.get(context, id)
        : this.invoices && moduleName === "sales" && resourceName === "invoices"
        ? await this.invoices.findById(context, id)
        : await this.repository.findById(
            {
              companyId: context.companyId,
              module: moduleName,
              resource: resourceName,
            },
            id,
          )
    if (!record) throw notFound()
    if (!this.enricher) return record
    const [enriched] = await this.enricher.enrich(
      context,
      moduleName,
      resourceName,
      [record],
    )
    return enriched ?? record
  }

  async create(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    input: WriteInput,
    idempotency?: IdempotencyInput,
    options: { allowWorkflowStatus?: boolean } = {},
  ) {
    requireMvpResource(moduleName, resourceName)
    if (moduleName === "accounting" && resourceName === "audit-log")
      throw conflict("Audit records are read-only")
    if (this.payments && moduleName === "sales" && resourceName === "payments")
      return this.payments.create(
        context,
        input,
        idempotency
          ? { idempotencyKey: idempotency.key, requestHash: idempotency.requestHash }
          : undefined,
      )
    if (this.invoices && isRelationalResource(moduleName, resourceName))
      return this.invoices.create(
        context,
        { status: input.status, data: input.data as InvoiceCreateData },
        idempotency
          ? { idempotencyKey: idempotency.key, requestHash: idempotency.requestHash }
          : undefined,
      )
    if (idempotency) {
      const previous = await this.repository.findByIdempotency(
        context.companyId,
        idempotency.key,
      )
      if (previous) {
        if (previous.requestHash !== idempotency.requestHash) {
          throw conflict(
            "Idempotency key was already used with a different request",
          )
        }
        return previous.record
      }
    }
    if (
      input.status &&
      protectedWorkflowStatuses.has(input.status.toLowerCase()) &&
      !options.allowWorkflowStatus
    ) {
      throw conflict(
        `Status ${input.status} must be created through its secured workflow endpoint`,
      )
    }
    const status = input.status ?? "draft"
    let data = this.validateData(moduleName, resourceName, input.data, status)
    const documentKey = `${moduleName}/${resourceName}`
    const prefix = documentPrefixes[documentKey]
    if (prefix && !data.documentNumber) {
      data = {
        ...data,
        documentNumber: await this.repository.nextDocumentNumber(
          context.companyId,
          documentKey,
          prefix,
        ),
      }
    }
    data = this.validateData(moduleName, resourceName, data, status)
    const now = new Date().toISOString()
    const record: ResourceRecord = {
      id: randomUUID(),
      module: moduleName,
      resource: resourceName,
      companyId: context.companyId,
      branchId: context.branchId,
      status,
      version: 1,
      data,
      createdAt: now,
      createdBy: context.principal.userId,
      updatedAt: now,
      updatedBy: context.principal.userId,
      isDeleted: false,
    }
    if (idempotency) {
      await this.repository.createIdempotent(
        record,
        idempotency.key,
        idempotency.requestHash,
      )
    } else {
      await this.repository.create(record)
    }
    await this.audit(context, "create", record, { after: record.data })
    await this.seedItemOpeningStock(context, moduleName, resourceName, record)
    await this.postCashSale(context, moduleName, resourceName, record)
    return record
  }

  /**
   * A cash sale never touches receivables: bank (or cash) is debited and sales
   * revenue is credited in the same moment the receipt is saved.
   */
  private async postCashSale(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    record: ResourceRecord,
  ) {
    if (moduleName !== "sales" || resourceName !== "sales-receipts") return
    if (!this.ledger) return
    const amount = String(
      record.data.total ?? record.data.amount ?? "0",
    )
    if (!/^\d+(\.\d+)?$/.test(amount) || Number(amount) <= 0) return
    const depositAccountId =
      typeof record.data.depositToAccountId === "string"
        ? record.data.depositToAccountId
        : undefined
    await this.ledger.post(
      context,
      createBalancedJournalEntry({
        sourceModule: "sales",
        sourceType: "sales_receipt",
        sourceId: record.id,
        idempotencyKey: `sales-receipt:${record.id}:post`,
        transactionDate: String(
          record.data.saleDate ?? record.createdAt.slice(0, 10),
        ),
        currency: String(record.data.currency ?? "USD"),
        memo: `Cash sale ${String(record.data.documentNumber ?? record.id)}`,
        lines: [
          {
            ...(depositAccountId
              ? { accountId: depositAccountId }
              : { systemAccountKey: systemAccountKeys.BANK }),
            description: "Cash sale received",
            debit: amount,
            credit: "0",
          },
          {
            systemAccountKey: systemAccountKeys.SALES_REVENUE,
            description: "Cash sale revenue",
            debit: "0",
            credit: amount,
          },
        ],
      }),
    )
  }

  /**
   * An inventory item's opening quantity only exists on the form until it is
   * written into the stock ledger (and the inventory asset account). The list
   * and the detail register both read from there, so skipping this step leaves
   * the table at zero while the form still shows what the user typed.
   */
  private async seedItemOpeningStock(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    record: ResourceRecord,
  ) {
    if (moduleName !== "inventory" || resourceName !== "items") return
    if (String(record.data.type ?? "").toLowerCase() !== "inventory") return
    if (!this.inventory) return
    const quantity = String(record.data.openingQuantity ?? "0")
    if (!/^\d+(\.\d+)?$/.test(quantity) || Number(quantity) <= 0) return
    const unitCost = String(record.data.purchaseCost ?? "0")
    const movement = await this.inventory.recordOpening(context, {
      itemId: record.id,
      quantity,
      unitCost,
      asOf:
        typeof record.data.asOf === "string" && record.data.asOf
          ? record.data.asOf
          : undefined,
    })
    if (!movement || !this.ledger) return
    const value = movement.valueDelta
    if (!/^\d+(\.\d+)?$/.test(value) || Number(value) <= 0) return
    const inventoryAccountId =
      typeof record.data.inventoryAccountId === "string"
        ? record.data.inventoryAccountId
        : undefined
    await this.ledger.post(
      context,
      createBalancedJournalEntry({
        sourceModule: "inventory",
        sourceType: "opening_balance",
        sourceId: record.id,
        idempotencyKey: `opening-gl:${record.id}`,
        transactionDate: (record.data.asOf as string) || record.createdAt.slice(0, 10),
        currency: String(record.data.currency ?? "USD"),
        memo: `Opening stock — ${String(record.data.name ?? record.id)}`,
        lines: [
          {
            ...(inventoryAccountId
              ? { accountId: inventoryAccountId }
              : { systemAccountKey: systemAccountKeys.INVENTORY_ASSET }),
            description: `Opening inventory — ${String(record.data.name ?? "")}`,
            debit: value,
            credit: "0",
          },
          {
            systemAccountKey: systemAccountKeys.OWNER_EQUITY,
            description: "Opening balance equity",
            debit: "0",
            credit: value,
          },
        ],
      }),
    )
  }

  async update(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    id: string,
    input: WriteInput,
    options: { allowWorkflowTransition?: boolean } = {},
  ) {
    requireMvpResource(moduleName, resourceName)
    if (moduleName === "accounting" && resourceName === "audit-log")
      throw conflict("Audit records are read-only")
    if (this.payments && moduleName === "sales" && resourceName === "payments")
      return this.payments.update(context, id, input)
    if (this.invoices && isRelationalResource(moduleName, resourceName))
      return this.invoices.update(context, id, {
        status: input.status,
        version: input.version,
        data: input.data as InvoiceUpdateData,
      })
    const current = await this.get(context, moduleName, resourceName, id)
    if (input.version !== undefined && input.version !== current.version)
      throw conflict(
        "Record was changed by another user. Refresh and try again.",
      )
    if (
      input.status &&
      input.status !== current.status &&
      protectedWorkflowStatuses.has(input.status.toLowerCase()) &&
      !options.allowWorkflowTransition
    ) {
      throw conflict(
        `Status ${input.status} must be set through its secured workflow endpoint`,
      )
    }
    const status = input.status ?? current.status
    const partial = status.toLowerCase() === "incomplete"
    let data = validateOperationalData(moduleName, resourceName, {
      ...current.data,
      ...input.data,
    }, { partial })
    if (!partial) {
      validateRequired(moduleName, resourceName, data)
      validateJournalBalance(moduleName, resourceName, data)
    }
    const updated: ResourceRecord = {
      ...current,
      data,
      status: input.status ?? current.status,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: context.principal.userId,
    }
    await this.repository.update(updated)
    await this.audit(context, "update", updated, {
      before: current.data,
      after: updated.data,
    })
    return updated
  }

  async remove(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    id: string,
  ) {
    requireMvpResource(moduleName, resourceName)
    if (moduleName === "accounting" && resourceName === "audit-log")
      throw conflict("Audit records are read-only")
    if (this.payments && moduleName === "sales" && resourceName === "payments")
      return this.payments.remove(context, id)
    if (this.invoices && isRelationalResource(moduleName, resourceName))
      return this.invoices.remove(context, id)
    const current = await this.get(context, moduleName, resourceName, id)
    if (current.status === "posted")
      throw conflict(
        "Posted records are immutable. Create a reversal or adjustment instead.",
      )
    const deleted = {
      ...current,
      isDeleted: true,
      deletedAt: new Date().toISOString(),
      updatedBy: context.principal.userId,
      version: current.version + 1,
    }
    await this.repository.softDelete(deleted)
    await this.audit(context, "delete", deleted, { before: current.data })
  }

  async listTrash(context: RequestContext, query: TrashQuery) {
    return this.repository.listDeleted(
      { companyId: context.companyId, branchId: context.branchId },
      query,
    )
  }

  async restore(context: RequestContext, id: string) {
    const current = await this.repository.findDeletedById(
      { companyId: context.companyId, branchId: context.branchId },
      id,
    )
    if (!current) throw notFound("Deleted record not found")
    const restored: ResourceRecord = {
      ...current,
      isDeleted: false,
      deletedAt: undefined,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: context.principal.userId,
    }
    await this.repository.restore(restored)
    await this.audit(context, "restore", restored, { after: restored.data })
    return restored
  }

  private async audit(
    context: RequestContext,
    action: string,
    record: ResourceRecord,
    changes?: Record<string, unknown>,
  ) {
    await this.repository.appendAudit({
      id: randomUUID(),
      requestId: context.requestId,
      companyId: context.companyId,
      branchId: context.branchId,
      userId: context.principal.userId,
      action,
      entityType: `${record.module}/${record.resource}`,
      entityId: record.id,
      occurredAt: new Date().toISOString(),
      changes,
    })
  }
}
