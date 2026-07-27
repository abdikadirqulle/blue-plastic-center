import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { auditEvents, documentSequences, idempotencyKeys, resourceRecords } from "../db/schema.js";
import type { AuditEvent, ListQuery, ResourceRecord } from "../platform/types.js";
import type { ResourceRepository } from "./resource-repository.js";

const toRecord = (row: typeof resourceRecords.$inferSelect): ResourceRecord => ({
  id: row.id,
  module: row.module,
  resource: row.resource,
  companyId: row.companyId,
  branchId: row.branchId,
  status: row.status,
  version: row.version,
  data: row.data,
  createdAt: row.createdAt.toISOString(),
  createdBy: row.createdBy,
  updatedAt: row.updatedAt.toISOString(),
  updatedBy: row.updatedBy,
  isDeleted: row.isDeleted,
  deletedAt: row.deletedAt?.toISOString(),
});

export class PostgresResourceRepository implements ResourceRepository {
  constructor(private readonly db: Database) {}

  async list(scope: { companyId: string; branchId?: string; module: string; resource: string }, query: ListQuery) {
    const conditions = [
      eq(resourceRecords.companyId, scope.companyId),
      eq(resourceRecords.module, scope.module),
      eq(resourceRecords.resource, scope.resource),
      eq(resourceRecords.isDeleted, false),
      isNull(resourceRecords.deletedAt),
    ];
    if (scope.branchId) conditions.push(eq(resourceRecords.branchId, scope.branchId));
    if (query.status) conditions.push(eq(resourceRecords.status, query.status));
    if (query.search) conditions.push(sql`${resourceRecords.data}::text ILIKE ${`%${query.search}%`}`);
    const where = and(...conditions);
    const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(resourceRecords).where(where);
    const orderColumn = query.sort === "updatedAt" ? resourceRecords.updatedAt : resourceRecords.createdAt;
    const rows = await this.db.select().from(resourceRecords).where(where)
      .orderBy(query.order === "asc" ? asc(orderColumn) : desc(orderColumn))
      .limit(query.pageSize).offset((query.page - 1) * query.pageSize);
    return { data: rows.map(toRecord), total: count };
  }

  async findById(scope: { companyId: string; module: string; resource: string }, id: string) {
    const [row] = await this.db.select().from(resourceRecords).where(and(
      eq(resourceRecords.id, id), eq(resourceRecords.companyId, scope.companyId),
      eq(resourceRecords.module, scope.module), eq(resourceRecords.resource, scope.resource),
      eq(resourceRecords.isDeleted, false),
      isNull(resourceRecords.deletedAt),
    )).limit(1);
    return row ? toRecord(row) : undefined;
  }

  async create(record: ResourceRecord) {
    await this.db.insert(resourceRecords).values({
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      isDeleted: record.isDeleted,
      deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
    });
    return record;
  }

  async findByIdempotency(companyId: string, key: string) {
    const [entry] = await this.db.select().from(idempotencyKeys).where(and(
      eq(idempotencyKeys.companyId, companyId),
      eq(idempotencyKeys.key, key),
    )).limit(1);
    if (!entry || entry.expiresAt <= new Date()) return undefined;
    const [row] = await this.db.select().from(resourceRecords).where(and(
      eq(resourceRecords.id, entry.resourceRecordId),
      eq(resourceRecords.isDeleted, false),
      isNull(resourceRecords.deletedAt),
    )).limit(1);
    return row ? { requestHash: entry.requestHash, record: toRecord(row) } : undefined;
  }

  async createIdempotent(record: ResourceRecord, key: string, requestHash: string) {
    await this.db.transaction(async (transaction) => {
      await transaction.insert(resourceRecords).values({
        ...record,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        isDeleted: false,
        deletedAt: null,
      });
      await transaction.insert(idempotencyKeys).values({
        companyId: record.companyId,
        key,
        requestHash,
        resourceRecordId: record.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      });
    });
    return record;
  }

  async nextDocumentNumber(companyId: string, documentType: string, prefix: string) {
    return this.db.transaction(async (transaction) => {
      await transaction.insert(documentSequences).values({
        companyId,
        documentType,
        prefix,
        nextNumber: 1,
        padding: 5,
      }).onConflictDoNothing();
      const [sequence] = await transaction.update(documentSequences).set({
        nextNumber: sql`${documentSequences.nextNumber} + 1`,
        updatedAt: new Date(),
      }).where(and(
        eq(documentSequences.companyId, companyId),
        eq(documentSequences.documentType, documentType),
      )).returning();
      const allocated = sequence.nextNumber - 1;
      return `${sequence.prefix}${String(allocated).padStart(sequence.padding, "0")}`;
    });
  }

  async update(record: ResourceRecord) {
    await this.db.update(resourceRecords).set({
      status: record.status, version: record.version, data: record.data,
      updatedAt: new Date(record.updatedAt), updatedBy: record.updatedBy,
      isDeleted: record.isDeleted,
      deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
    }).where(eq(resourceRecords.id, record.id));
    return record;
  }

  async softDelete(record: ResourceRecord) {
    await this.update(record);
  }

  async appendAudit(event: AuditEvent) {
    await this.db.insert(auditEvents).values({ ...event, occurredAt: new Date(event.occurredAt) });
  }

  async listAudit(companyId: string, limit = 100) {
    const rows = await this.db.select().from(auditEvents).where(eq(auditEvents.companyId, companyId)).orderBy(desc(auditEvents.occurredAt)).limit(limit);
    return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString(), changes: row.changes ?? undefined }));
  }
}
