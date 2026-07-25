import type { AuditEvent, ListQuery, ResourceRecord } from "../platform/types.js";
import type { ResourceRepository } from "./resource-repository.js";

export class MemoryResourceRepository implements ResourceRepository {
  private records = new Map<string, ResourceRecord>();
  private audit: AuditEvent[] = [];

  async list(scope: { companyId: string; branchId?: string; module: string; resource: string }, query: ListQuery) {
    const search = query.search?.toLowerCase();
    const filtered = [...this.records.values()].filter((record) =>
      !record.deletedAt
      && record.companyId === scope.companyId
      && (!scope.branchId || record.branchId === scope.branchId)
      && record.module === scope.module
      && record.resource === scope.resource
      && (!query.status || record.status === query.status)
      && (!search || JSON.stringify(record.data).toLowerCase().includes(search) || record.id.toLowerCase().includes(search)),
    );
    filtered.sort((a, b) => {
      const field = query.sort ?? "createdAt";
      const comparison = a[field].localeCompare(b[field]);
      return query.order === "asc" ? comparison : -comparison;
    });
    const start = (query.page - 1) * query.pageSize;
    return { data: filtered.slice(start, start + query.pageSize), total: filtered.length };
  }

  async findById(scope: { companyId: string; module: string; resource: string }, id: string) {
    const record = this.records.get(id);
    if (!record || record.deletedAt || record.companyId !== scope.companyId || record.module !== scope.module || record.resource !== scope.resource) return undefined;
    return record;
  }

  async create(record: ResourceRecord) {
    this.records.set(record.id, record);
    return record;
  }

  async update(record: ResourceRecord) {
    this.records.set(record.id, record);
    return record;
  }

  async softDelete(record: ResourceRecord) {
    this.records.set(record.id, record);
  }

  async appendAudit(event: AuditEvent) {
    this.audit.push(event);
  }

  async listAudit(companyId: string, limit = 100) {
    return this.audit.filter((event) => event.companyId === companyId).slice(-limit).reverse();
  }
}
