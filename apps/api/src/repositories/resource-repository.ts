import type { AuditEvent, ListQuery, ResourceRecord, TrashQuery } from "../platform/types.js";

export interface ResourceRepository {
  list(scope: { companyId: string; branchId?: string; module: string; resource: string }, query: ListQuery): Promise<{ data: ResourceRecord[]; total: number }>;
  findById(scope: { companyId: string; module: string; resource: string }, id: string): Promise<ResourceRecord | undefined>;
  create(record: ResourceRecord): Promise<ResourceRecord>;
  findByIdempotency(companyId: string, key: string): Promise<{ requestHash: string; record: ResourceRecord } | undefined>;
  createIdempotent(record: ResourceRecord, key: string, requestHash: string): Promise<ResourceRecord>;
  nextDocumentNumber(companyId: string, documentType: string, prefix: string): Promise<string>;
  update(record: ResourceRecord): Promise<ResourceRecord>;
  softDelete(record: ResourceRecord): Promise<void>;
  listDeleted(scope: { companyId: string; branchId?: string }, query: TrashQuery): Promise<{ data: ResourceRecord[]; total: number }>;
  findDeletedById(scope: { companyId: string; branchId?: string }, id: string): Promise<ResourceRecord | undefined>;
  restore(record: ResourceRecord): Promise<ResourceRecord>;
  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(companyId: string, limit?: number): Promise<AuditEvent[]>;
}
