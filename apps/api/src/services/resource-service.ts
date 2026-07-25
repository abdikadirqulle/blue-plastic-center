import { randomUUID } from "node:crypto";
import { getResourceDefinition } from "../domain/modules.js";
import { conflict, notFound, validation } from "../platform/errors.js";
import type { ListQuery, RequestContext, ResourceRecord } from "../platform/types.js";
import type { ResourceRepository } from "../repositories/resource-repository.js";

interface WriteInput {
  status?: string;
  data: Record<string, unknown>;
  version?: number;
}

function validateRequired(moduleName: string, resourceName: string, data: Record<string, unknown>) {
  const definition = getResourceDefinition(moduleName, resourceName);
  if (!definition) throw notFound(`Unknown API resource: ${moduleName}/${resourceName}`);
  const missing = definition.requiredFields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  });
  if (missing.length) throw validation("Required fields are missing", { fields: missing });
}

function validateJournalBalance(moduleName: string, resourceName: string, data: Record<string, unknown>) {
  if (moduleName !== "accounting" || resourceName !== "journal-entries") return;
  const lines = data.lines;
  if (!Array.isArray(lines) || lines.length < 2) throw validation("A journal entry requires at least two lines");
  const totals = lines.reduce((sum, value) => {
    const line = value as Record<string, unknown>;
    return {
      debit: sum.debit + Number(line.debit ?? 0),
      credit: sum.credit + Number(line.credit ?? 0),
    };
  }, { debit: 0, credit: 0 });
  if (!Number.isFinite(totals.debit) || !Number.isFinite(totals.credit) || Math.abs(totals.debit - totals.credit) > 0.000001) {
    throw validation("Journal entry is not balanced", totals);
  }
}

export class ResourceService {
  constructor(private readonly repository: ResourceRepository) {}

  async list(context: RequestContext, moduleName: string, resourceName: string, query: ListQuery) {
    if (!getResourceDefinition(moduleName, resourceName)) throw notFound(`Unknown API resource: ${moduleName}/${resourceName}`);
    return this.repository.list({ companyId: context.companyId, branchId: context.branchId, module: moduleName, resource: resourceName }, query);
  }

  async get(context: RequestContext, moduleName: string, resourceName: string, id: string) {
    const record = await this.repository.findById({ companyId: context.companyId, module: moduleName, resource: resourceName }, id);
    if (!record) throw notFound();
    return record;
  }

  async create(context: RequestContext, moduleName: string, resourceName: string, input: WriteInput) {
    validateRequired(moduleName, resourceName, input.data);
    validateJournalBalance(moduleName, resourceName, input.data);
    const now = new Date().toISOString();
    const record: ResourceRecord = {
      id: randomUUID(),
      module: moduleName,
      resource: resourceName,
      companyId: context.companyId,
      branchId: context.branchId,
      status: input.status ?? "draft",
      version: 1,
      data: input.data,
      createdAt: now,
      createdBy: context.principal.userId,
      updatedAt: now,
      updatedBy: context.principal.userId,
    };
    await this.repository.create(record);
    await this.audit(context, "create", record, { after: record.data });
    return record;
  }

  async update(context: RequestContext, moduleName: string, resourceName: string, id: string, input: WriteInput) {
    const current = await this.get(context, moduleName, resourceName, id);
    if (input.version !== undefined && input.version !== current.version) throw conflict("Record was changed by another user. Refresh and try again.");
    const data = { ...current.data, ...input.data };
    validateRequired(moduleName, resourceName, data);
    validateJournalBalance(moduleName, resourceName, data);
    const updated: ResourceRecord = {
      ...current,
      data,
      status: input.status ?? current.status,
      version: current.version + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: context.principal.userId,
    };
    await this.repository.update(updated);
    await this.audit(context, "update", updated, { before: current.data, after: updated.data });
    return updated;
  }

  async remove(context: RequestContext, moduleName: string, resourceName: string, id: string) {
    const current = await this.get(context, moduleName, resourceName, id);
    if (current.status === "posted") throw conflict("Posted records are immutable. Create a reversal or adjustment instead.");
    const deleted = { ...current, deletedAt: new Date().toISOString(), updatedBy: context.principal.userId, version: current.version + 1 };
    await this.repository.softDelete(deleted);
    await this.audit(context, "delete", deleted, { before: current.data });
  }

  async postJournal(context: RequestContext, id: string) {
    const current = await this.get(context, "accounting", "journal-entries", id);
    if (current.status === "posted") throw conflict("Journal entry is already posted");
    validateJournalBalance("accounting", "journal-entries", current.data);
    const posted = { ...current, status: "posted", version: current.version + 1, updatedAt: new Date().toISOString(), updatedBy: context.principal.userId };
    await this.repository.update(posted);
    await this.audit(context, "post", posted);
    return posted;
  }

  private async audit(context: RequestContext, action: string, record: ResourceRecord, changes?: Record<string, unknown>) {
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
    });
  }
}
