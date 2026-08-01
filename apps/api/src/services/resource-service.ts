import { randomUUID } from "node:crypto"
import type { InvoiceCreateData, InvoiceUpdateData } from "@blue-plastic/types"
import { getResourceDefinition } from "../domain/modules.js"
import { conflict, notFound, validation } from "../platform/errors.js"
import type {
  ListQuery,
  RequestContext,
  ResourceRecord,
  TrashQuery,
} from "../platform/types.js"
import type { ResourceRepository } from "../repositories/resource-repository.js"
import type { InvoiceRepository } from "../modules/sales/invoice-repository.js"
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

export class ResourceService {
  /**
   * Callers that still speak the generic resource language — conversions,
   * progress billing, reports — are delegated to the normalized invoice
   * repository so invoices keep exactly one source of truth.
   */
  constructor(
    private readonly repository: ResourceRepository,
    private readonly invoices?: InvoiceRepository,
  ) {}

  validateData(
    moduleName: string,
    resourceName: string,
    input: Record<string, unknown>,
    status = "draft",
  ) {
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
    if (!getResourceDefinition(moduleName, resourceName))
      throw notFound(`Unknown API resource: ${moduleName}/${resourceName}`)
    if (this.invoices && isRelationalResource(moduleName, resourceName))
      return this.invoices.list(context, query)
    return this.repository.list(
      {
        companyId: context.companyId,
        branchId: context.branchId,
        module: moduleName,
        resource: resourceName,
      },
      query,
    )
  }

  async get(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    id: string,
  ) {
    const record =
      this.invoices && isRelationalResource(moduleName, resourceName)
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
    return record
  }

  async create(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    input: WriteInput,
    idempotency?: IdempotencyInput,
    options: { allowWorkflowStatus?: boolean } = {},
  ) {
    if (moduleName === "accounting" && resourceName === "audit-log")
      throw conflict("Audit records are read-only")
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
    return record
  }

  async update(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    id: string,
    input: WriteInput,
    options: { allowWorkflowTransition?: boolean } = {},
  ) {
    if (moduleName === "accounting" && resourceName === "audit-log")
      throw conflict("Audit records are read-only")
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
    if (moduleName === "accounting" && resourceName === "audit-log")
      throw conflict("Audit records are read-only")
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
