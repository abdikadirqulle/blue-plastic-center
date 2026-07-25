import type { AuditEvent, ListQuery, ResourceRecord } from "../platform/types.js";

export interface ResourceRepository {
  list(scope: { companyId: string; branchId?: string; module: string; resource: string }, query: ListQuery): Promise<{ data: ResourceRecord[]; total: number }>;
  findById(scope: { companyId: string; module: string; resource: string }, id: string): Promise<ResourceRecord | undefined>;
  create(record: ResourceRecord): Promise<ResourceRecord>;
  update(record: ResourceRecord): Promise<ResourceRecord>;
  softDelete(record: ResourceRecord): Promise<void>;
  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(companyId: string, limit?: number): Promise<AuditEvent[]>;
}
