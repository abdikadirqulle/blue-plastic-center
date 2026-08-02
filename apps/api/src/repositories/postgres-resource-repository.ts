import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  auditEvents,
  accounts,
  customers,
  documentSequences,
  idempotencyKeys,
  items,
  resourceRecords,
} from "../db/schema.js";
import type { AuditEvent, ListQuery, ResourceRecord, TrashQuery } from "../platform/types.js";
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

const dateText = (value: Date) => value.toISOString().slice(0, 10)

const customerRecord = (
  row: typeof customers.$inferSelect,
  fallbackBranchId = "",
): ResourceRecord => ({
  id: row.id,
  module: "sales",
  resource: "customers",
  companyId: row.companyId,
  branchId: row.branchId ?? fallbackBranchId,
  status: row.active ? "active" : "inactive",
  version: row.version,
  data: {
    displayName: row.displayName,
    companyName: row.companyName,
    email: row.email,
    phone: row.phone,
    currency: row.currency,
    paymentTermId: row.paymentTermId,
    receivableAccountId: row.receivableAccountId,
    openingBalance: row.openingBalance,
  },
  createdAt: row.createdAt.toISOString(),
  createdBy: row.createdBy ?? "",
  updatedAt: row.updatedAt.toISOString(),
  updatedBy: row.updatedBy ?? "",
  isDeleted: row.isDeleted,
  deletedAt: row.deletedAt?.toISOString(),
})

const accountRecord = (
  row: typeof accounts.$inferSelect,
  branchId = "",
): ResourceRecord => ({
  id: row.id,
  module: "accounting",
  resource: "chart-of-accounts",
  companyId: row.companyId,
  branchId,
  status: row.active ? "active" : "inactive",
  version: 1,
  data: {
    accountNumber: row.accountNumber,
    accountName: row.name,
    accountType: row.type,
    parentId: row.parentId,
    currency: row.currency,
    systemKey: row.systemKey,
  },
  createdAt: row.createdAt.toISOString(),
  createdBy: "",
  updatedAt: row.updatedAt.toISOString(),
  updatedBy: "",
  isDeleted: false,
})

const itemRecord = (row: typeof items.$inferSelect): ResourceRecord => ({
  id: row.id,
  module: "inventory",
  resource: "items",
  companyId: row.companyId,
  branchId: row.branchId ?? "",
  status: row.active ? "active" : "inactive",
  version: row.version,
  data: {
    sku: row.sku,
    name: row.name,
    type: row.type,
    salesPrice: row.salesPrice,
    purchaseCost: row.purchaseCost,
    incomeAccountId: row.incomeAccountId,
    expenseAccountId: row.expenseAccountId,
    inventoryAccountId: row.inventoryAccountId,
    taxCodeId: row.taxCodeId,
  },
  createdAt: row.createdAt.toISOString(),
  createdBy: row.createdBy ?? "",
  updatedAt: row.updatedAt.toISOString(),
  updatedBy: row.updatedBy ?? "",
  isDeleted: row.isDeleted,
  deletedAt: row.deletedAt?.toISOString(),
})

const isRelationalResource = (moduleName: string, resourceName: string) =>
  (moduleName === "sales" && resourceName === "customers") ||
  (moduleName === "inventory" && resourceName === "items") ||
  (moduleName === "accounting" && resourceName === "chart-of-accounts")

export class PostgresResourceRepository implements ResourceRepository {
  constructor(private readonly db: Database) {}

  private async shadow(record: ResourceRecord) {
    await this.db.insert(resourceRecords).values({
      ...record,
      createdAt: new Date(record.createdAt),
      updatedAt: new Date(record.updatedAt),
      deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
    }).onConflictDoUpdate({
      target: resourceRecords.id,
      set: {
        status: record.status,
        version: record.version,
        data: record.data,
        updatedAt: new Date(record.updatedAt),
        updatedBy: record.updatedBy,
        isDeleted: record.isDeleted,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
      },
    })
  }

  private async mergeShadow(record: ResourceRecord) {
    const [shadow] = await this.db.select().from(resourceRecords).where(and(
      eq(resourceRecords.id, record.id),
      eq(resourceRecords.companyId, record.companyId),
    )).limit(1)
    return shadow
      ? {
          ...record,
          status: shadow.status,
          version: shadow.version,
          data: { ...shadow.data, ...record.data },
          isDeleted: shadow.isDeleted,
          deletedAt: shadow.deletedAt?.toISOString(),
        }
      : record
  }

  async list(scope: { companyId: string; branchId?: string; module: string; resource: string }, query: ListQuery) {
    if (scope.module === "accounting" && scope.resource === "chart-of-accounts") {
      const conditions = [
        eq(accounts.companyId, scope.companyId),
        sql`not exists (
          select 1 from ${resourceRecords}
          where ${resourceRecords.id} = ${accounts.id}
            and ${resourceRecords.isDeleted} = true
        )`,
      ]
      if (query.status) conditions.push(eq(accounts.active, query.status === "active"))
      if (query.search)
        conditions.push(sql`concat_ws(' ', ${accounts.accountNumber}, ${accounts.name}, ${accounts.type}) ILIKE ${`%${query.search}%`}`)
      const where = and(...conditions)
      const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(accounts).where(where)
      const rows = await this.db.select().from(accounts).where(where)
        .orderBy(query.order === "asc" ? asc(accounts.accountNumber) : desc(accounts.accountNumber))
        .limit(query.pageSize).offset((query.page - 1) * query.pageSize)
      return { data: rows.map((row) => accountRecord(row, scope.branchId)), total: count }
    }
    if (scope.module === "inventory" && scope.resource === "items") {
      const conditions = [
        eq(items.companyId, scope.companyId),
        eq(items.isDeleted, false),
        isNull(items.deletedAt),
      ]
      if (scope.branchId) conditions.push(eq(items.branchId, scope.branchId))
      if (query.status) conditions.push(eq(items.active, query.status === "active"))
      if (query.search)
        conditions.push(sql`concat_ws(' ', ${items.sku}, ${items.name}, ${items.type}) ILIKE ${`%${query.search}%`}`)
      const where = and(...conditions)
      const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(items).where(where)
      const rows = await this.db.select().from(items).where(where)
        .orderBy(query.order === "asc" ? asc(items.createdAt) : desc(items.createdAt))
        .limit(query.pageSize).offset((query.page - 1) * query.pageSize)
      return { data: rows.map(itemRecord), total: count }
    }
    if (scope.module === "sales" && scope.resource === "customers") {
      const conditions = [
        eq(customers.companyId, scope.companyId),
        eq(customers.isDeleted, false),
        isNull(customers.deletedAt),
      ]
      if (scope.branchId) conditions.push(eq(customers.branchId, scope.branchId))
      if (query.status) conditions.push(eq(customers.active, query.status === "active"))
      if (query.search)
        conditions.push(sql`concat_ws(' ', ${customers.displayName}, ${customers.companyName}, ${customers.email}, ${customers.phone}) ILIKE ${`%${query.search}%`}`)
      const where = and(...conditions)
      const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(customers).where(where)
      const rows = await this.db.select().from(customers).where(where)
        .orderBy(query.order === "asc" ? asc(customers.createdAt) : desc(customers.createdAt))
        .limit(query.pageSize).offset((query.page - 1) * query.pageSize)
      return { data: rows.map((row) => customerRecord(row, scope.branchId)), total: count }
    }
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
    if (scope.module === "accounting" && scope.resource === "chart-of-accounts") {
      const [row] = await this.db.select().from(accounts).where(and(
        eq(accounts.id, id), eq(accounts.companyId, scope.companyId),
      )).limit(1)
      if (!row) return undefined
      const record = await this.mergeShadow(accountRecord(row))
      return record.isDeleted ? undefined : record
    }
    if (scope.module === "inventory" && scope.resource === "items") {
      const [row] = await this.db.select().from(items).where(and(
        eq(items.id, id), eq(items.companyId, scope.companyId),
        eq(items.isDeleted, false), isNull(items.deletedAt),
      )).limit(1)
      if (!row) return undefined
      const record = await this.mergeShadow(itemRecord(row))
      return record.isDeleted ? undefined : record
    }
    if (scope.module === "sales" && scope.resource === "customers") {
      const [row] = await this.db.select().from(customers).where(and(
        eq(customers.id, id), eq(customers.companyId, scope.companyId),
        eq(customers.isDeleted, false), isNull(customers.deletedAt),
      )).limit(1)
      if (!row) return undefined
      const record = await this.mergeShadow(customerRecord(row))
      return record.isDeleted ? undefined : record
    }
    const [row] = await this.db.select().from(resourceRecords).where(and(
      eq(resourceRecords.id, id), eq(resourceRecords.companyId, scope.companyId),
      eq(resourceRecords.module, scope.module), eq(resourceRecords.resource, scope.resource),
      eq(resourceRecords.isDeleted, false),
      isNull(resourceRecords.deletedAt),
    )).limit(1);
    return row ? toRecord(row) : undefined;
  }

  async create(record: ResourceRecord) {
    if (record.module === "accounting" && record.resource === "chart-of-accounts") {
      await this.db.insert(accounts).values({
        id: record.id,
        companyId: record.companyId,
        parentId: typeof record.data.parentId === "string" && record.data.parentId ? record.data.parentId : null,
        accountNumber: String(record.data.accountNumber),
        name: String(record.data.accountName ?? record.data.name),
        type: String(record.data.accountType),
        currency: String(record.data.currency ?? "USD"),
        active: record.status !== "inactive",
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      })
      await this.shadow(record)
      return record
    }
    if (record.module === "inventory" && record.resource === "items") {
      await this.db.insert(items).values({
        id: record.id,
        companyId: record.companyId,
        branchId: record.branchId,
        sku: String(record.data.sku),
        name: String(record.data.name),
        type: String(record.data.type),
        salesPrice: String(record.data.salesPrice ?? "0"),
        purchaseCost: String(record.data.purchaseCost ?? "0"),
        incomeAccountId: typeof record.data.incomeAccountId === "string" && record.data.incomeAccountId ? record.data.incomeAccountId : null,
        expenseAccountId: typeof record.data.expenseAccountId === "string" && record.data.expenseAccountId ? record.data.expenseAccountId : null,
        inventoryAccountId: typeof record.data.inventoryAccountId === "string" && record.data.inventoryAccountId ? record.data.inventoryAccountId : null,
        active: record.status !== "inactive",
        version: record.version,
        createdBy: record.createdBy,
        updatedBy: record.updatedBy,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      })
      await this.shadow(record)
      return record
    }
    if (record.module === "sales" && record.resource === "customers") {
      await this.db.insert(customers).values({
        id: record.id,
        companyId: record.companyId,
        branchId: record.branchId,
        displayName: String(record.data.displayName),
        companyName: typeof record.data.companyName === "string" ? record.data.companyName : null,
        email: typeof record.data.email === "string" ? record.data.email : null,
        phone: typeof record.data.phone === "string" ? record.data.phone : null,
        currency: typeof record.data.currency === "string" ? record.data.currency : "USD",
        openingBalance: String(record.data.openingBalance ?? "0"),
        receivableAccountId:
          typeof record.data.receivableAccountId === "string" &&
          record.data.receivableAccountId
            ? record.data.receivableAccountId
            : null,
        active: record.status !== "inactive",
        version: record.version,
        createdBy: record.createdBy,
        updatedBy: record.updatedBy,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      })
      await this.shadow(record)
      return record
    }
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
    if (isRelationalResource(record.module, record.resource)) {
      const created = await this.create(record)
      await this.db.insert(idempotencyKeys).values({
        companyId: record.companyId,
        key,
        requestHash,
        resourceRecordId: record.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
      })
      return created
    }
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
    if (record.module === "accounting" && record.resource === "chart-of-accounts") {
      await this.db.update(accounts).set({
        parentId: typeof record.data.parentId === "string" && record.data.parentId ? record.data.parentId : null,
        accountNumber: String(record.data.accountNumber),
        name: String(record.data.accountName ?? record.data.name),
        type: String(record.data.accountType),
        currency: String(record.data.currency ?? "USD"),
        active: !record.isDeleted && record.status !== "inactive",
        updatedAt: new Date(record.updatedAt),
      }).where(and(eq(accounts.id, record.id), eq(accounts.companyId, record.companyId)))
      await this.shadow(record)
      return record
    }
    if (record.module === "inventory" && record.resource === "items") {
      await this.db.update(items).set({
        sku: String(record.data.sku),
        name: String(record.data.name),
        type: String(record.data.type),
        salesPrice: String(record.data.salesPrice ?? "0"),
        purchaseCost: String(record.data.purchaseCost ?? "0"),
        incomeAccountId: typeof record.data.incomeAccountId === "string" && record.data.incomeAccountId ? record.data.incomeAccountId : null,
        expenseAccountId: typeof record.data.expenseAccountId === "string" && record.data.expenseAccountId ? record.data.expenseAccountId : null,
        inventoryAccountId: typeof record.data.inventoryAccountId === "string" && record.data.inventoryAccountId ? record.data.inventoryAccountId : null,
        active: !record.isDeleted && record.status !== "inactive",
        version: record.version,
        updatedBy: record.updatedBy,
        updatedAt: new Date(record.updatedAt),
        isDeleted: record.isDeleted,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
      }).where(and(eq(items.id, record.id), eq(items.companyId, record.companyId)))
      await this.shadow(record)
      return record
    }
    if (record.module === "sales" && record.resource === "customers") {
      await this.db.update(customers).set({
        displayName: String(record.data.displayName),
        companyName: typeof record.data.companyName === "string" ? record.data.companyName : null,
        email: typeof record.data.email === "string" ? record.data.email : null,
        phone: typeof record.data.phone === "string" ? record.data.phone : null,
        currency: String(record.data.currency ?? "USD"),
        openingBalance: String(record.data.openingBalance ?? "0"),
        receivableAccountId:
          typeof record.data.receivableAccountId === "string" &&
          record.data.receivableAccountId
            ? record.data.receivableAccountId
            : null,
        active: record.status !== "inactive",
        version: record.version,
        updatedBy: record.updatedBy,
        updatedAt: new Date(record.updatedAt),
        isDeleted: record.isDeleted,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
      }).where(and(eq(customers.id, record.id), eq(customers.companyId, record.companyId)))
      await this.shadow(record)
      return record
    }
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

  async listDeleted(
    scope: { companyId: string; branchId?: string },
    query: TrashQuery,
  ) {
    const conditions = [
      eq(resourceRecords.companyId, scope.companyId),
      eq(resourceRecords.isDeleted, true),
    ];
    if (scope.branchId) conditions.push(eq(resourceRecords.branchId, scope.branchId));
    if (query.module) conditions.push(eq(resourceRecords.module, query.module));
    if (query.resource) conditions.push(eq(resourceRecords.resource, query.resource));
    if (query.status) conditions.push(eq(resourceRecords.status, query.status));
    if (query.search)
      conditions.push(sql`${resourceRecords.data}::text ILIKE ${`%${query.search}%`}`);
    const where = and(...conditions);
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(resourceRecords)
      .where(where);
    const orderColumn =
      query.sort === "createdAt" ? resourceRecords.createdAt : resourceRecords.updatedAt;
    const rows = await this.db
      .select()
      .from(resourceRecords)
      .where(where)
      .orderBy(query.order === "asc" ? asc(orderColumn) : desc(orderColumn))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize);
    return { data: rows.map(toRecord), total: count };
  }

  async findDeletedById(
    scope: { companyId: string; branchId?: string },
    id: string,
  ) {
    const conditions = [
      eq(resourceRecords.id, id),
      eq(resourceRecords.companyId, scope.companyId),
      eq(resourceRecords.isDeleted, true),
    ];
    if (scope.branchId) conditions.push(eq(resourceRecords.branchId, scope.branchId));
    const [row] = await this.db
      .select()
      .from(resourceRecords)
      .where(and(...conditions))
      .limit(1);
    return row ? toRecord(row) : undefined;
  }

  async restore(record: ResourceRecord) {
    await this.update(record);
    return record;
  }

  async appendAudit(event: AuditEvent) {
    await this.db.insert(auditEvents).values({ ...event, occurredAt: new Date(event.occurredAt) });
  }

  async listAudit(companyId: string, limit = 100) {
    const rows = await this.db.select().from(auditEvents).where(eq(auditEvents.companyId, companyId)).orderBy(desc(auditEvents.occurredAt)).limit(limit);
    return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString(), changes: row.changes ?? undefined }));
  }

  async listAuditFor(companyId: string, entityType: string, entityId: string, limit = 50) {
    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(and(
        eq(auditEvents.companyId, companyId),
        eq(auditEvents.entityType, entityType),
        eq(auditEvents.entityId, entityId),
      ))
      .orderBy(desc(auditEvents.occurredAt))
      .limit(limit);
    return rows.map((row) => ({ ...row, occurredAt: row.occurredAt.toISOString(), changes: row.changes ?? undefined }));
  }
}
