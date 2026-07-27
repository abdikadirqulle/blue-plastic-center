import { and, asc, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import {
  auditEvents,
  accounts,
  customers,
  documentSequences,
  idempotencyKeys,
  invoiceLines,
  invoices,
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

const invoiceRecord = (
  row: typeof invoices.$inferSelect,
  lines: Array<typeof invoiceLines.$inferSelect> = [],
): ResourceRecord => ({
  id: row.id,
  module: "sales",
  resource: "invoices",
  companyId: row.companyId,
  branchId: row.branchId,
  status: row.status,
  version: row.version,
  data: {
    customerId: row.customerId,
    documentNumber: row.invoiceNumber,
    invoiceDate: dateText(row.invoiceDate),
    dueDate: dateText(row.dueDate),
    currency: row.currency,
    exchangeRate: row.exchangeRate,
    customerPurchaseOrder: row.customerPurchaseOrder,
    memo: row.memo,
    subtotal: row.subtotal,
    discountTotal: row.discountTotal,
    taxTotal: row.taxTotal,
    total: row.total,
    amountPaid: row.amountPaid,
    balanceDue: row.balanceDue,
    lines: lines.map((line) => ({
      id: line.id,
      itemId: line.itemId,
      accountId: line.accountId,
      taxCodeId: line.taxCodeId,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discountAmount: line.discountAmount,
      taxAmount: line.taxAmount,
      lineTotal: line.lineTotal,
      lineNumber: line.lineNumber,
    })),
  },
  createdAt: row.createdAt.toISOString(),
  createdBy: row.createdBy,
  updatedAt: row.updatedAt.toISOString(),
  updatedBy: row.updatedBy,
  isDeleted: row.isDeleted,
  deletedAt: row.deletedAt?.toISOString(),
})

const isRelationalSales = (moduleName: string, resourceName: string) =>
  moduleName === "sales" && ["customers", "invoices"].includes(resourceName)

export class PostgresResourceRepository implements ResourceRepository {
  constructor(private readonly db: Database) {}

  async list(scope: { companyId: string; branchId?: string; module: string; resource: string }, query: ListQuery) {
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
    if (scope.module === "sales" && scope.resource === "invoices") {
      const conditions = [
        eq(invoices.companyId, scope.companyId),
        eq(invoices.isDeleted, false),
        isNull(invoices.deletedAt),
      ]
      if (scope.branchId) conditions.push(eq(invoices.branchId, scope.branchId))
      if (query.status) conditions.push(eq(invoices.status, query.status))
      if (query.search) conditions.push(sql`${invoices.invoiceNumber} ILIKE ${`%${query.search}%`}`)
      const where = and(...conditions)
      const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(invoices).where(where)
      const rows = await this.db.select().from(invoices).where(where)
        .orderBy(query.order === "asc" ? asc(invoices.createdAt) : desc(invoices.createdAt))
        .limit(query.pageSize).offset((query.page - 1) * query.pageSize)
      return { data: rows.map((row) => invoiceRecord(row)), total: count }
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
    if (scope.module === "sales" && scope.resource === "customers") {
      const [row] = await this.db.select().from(customers).where(and(
        eq(customers.id, id), eq(customers.companyId, scope.companyId),
        eq(customers.isDeleted, false), isNull(customers.deletedAt),
      )).limit(1)
      return row ? customerRecord(row) : undefined
    }
    if (scope.module === "sales" && scope.resource === "invoices") {
      const [row] = await this.db.select().from(invoices).where(and(
        eq(invoices.id, id), eq(invoices.companyId, scope.companyId),
        eq(invoices.isDeleted, false), isNull(invoices.deletedAt),
      )).limit(1)
      if (!row) return undefined
      const lines = await this.db.select().from(invoiceLines)
        .where(eq(invoiceLines.invoiceId, row.id)).orderBy(asc(invoiceLines.lineNumber))
      return invoiceRecord(row, lines)
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
        active: record.status !== "inactive",
        version: record.version,
        createdBy: record.createdBy,
        updatedBy: record.updatedBy,
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
      })
      return record
    }
    if (record.module === "sales" && record.resource === "invoices") {
      const sourceLines = Array.isArray(record.data.lines) ? record.data.lines as Array<Record<string, unknown>> : []
      await this.db.transaction(async (transaction) => {
        const customerReference = String(record.data.customerId)
        const [customer] = await transaction.select({ id: customers.id }).from(customers).where(and(
          eq(customers.companyId, record.companyId),
          or(
            sql`${customers.id}::text = ${customerReference}`,
            eq(customers.displayName, customerReference),
          ),
          eq(customers.isDeleted, false),
        )).limit(1)
        if (!customer) throw new Error(`Customer "${customerReference}" does not exist`)
        await transaction.insert(invoices).values({
          id: record.id,
          companyId: record.companyId,
          branchId: record.branchId,
          customerId: customer.id,
          invoiceNumber: String(record.data.documentNumber),
          invoiceDate: new Date(String(record.data.invoiceDate)),
          dueDate: new Date(String(record.data.dueDate)),
          currency: String(record.data.currency),
          exchangeRate: String(record.data.exchangeRate ?? "1"),
          status: record.status,
          customerPurchaseOrder: typeof record.data.customerPurchaseOrder === "string" ? record.data.customerPurchaseOrder : null,
          memo: typeof record.data.memo === "string" ? record.data.memo : null,
          subtotal: String(record.data.subtotal ?? record.data.total ?? "0"),
          discountTotal: String(record.data.discountTotal ?? "0"),
          taxTotal: String(record.data.taxTotal ?? "0"),
          total: String(record.data.total ?? "0"),
          amountPaid: String(record.data.amountPaid ?? "0"),
          balanceDue: String(record.data.balanceDue ?? record.data.total ?? "0"),
          version: record.version,
          createdBy: record.createdBy,
          updatedBy: record.updatedBy,
          createdAt: new Date(record.createdAt),
          updatedAt: new Date(record.updatedAt),
        })
        if (sourceLines.length) {
          const resolvedLines = []
          for (const [index, line] of sourceLines.entries()) {
            const reference = String(line.itemId ?? line.accountId ?? "")
            const [item] = await transaction.select({ id: items.id }).from(items).where(and(
              eq(items.companyId, record.companyId),
              or(sql`${items.id}::text = ${reference}`, eq(items.sku, reference), eq(items.name, reference)),
              eq(items.isDeleted, false),
            )).limit(1)
            const [account] = item ? [] : await transaction.select({ id: accounts.id }).from(accounts).where(and(
              eq(accounts.companyId, record.companyId),
              or(sql`${accounts.id}::text = ${reference}`, eq(accounts.accountNumber, reference), eq(accounts.name, reference)),
              eq(accounts.active, true),
            )).limit(1)
            if (!item && !account) throw new Error(`Item or account "${reference}" does not exist`)
            resolvedLines.push({
            invoiceId: record.id,
            itemId: item?.id ?? null,
            accountId: account?.id ?? null,
            taxCodeId: null,
            description: String(line.description ?? line.item ?? "Invoice line"),
            quantity: String(line.quantity ?? "1"),
            unitPrice: String(line.unitPrice ?? line.rate ?? "0"),
            discountAmount: String(line.discountAmount ?? "0"),
            taxAmount: String(line.taxAmount ?? "0"),
            lineTotal: String(line.lineTotal ?? line.amount ?? "0"),
            lineNumber: index + 1,
            })
          }
          await transaction.insert(invoiceLines).values(resolvedLines)
        }
      })
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
    if (isRelationalSales(record.module, record.resource)) {
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
    if (record.module === "sales" && record.resource === "customers") {
      await this.db.update(customers).set({
        displayName: String(record.data.displayName),
        companyName: typeof record.data.companyName === "string" ? record.data.companyName : null,
        email: typeof record.data.email === "string" ? record.data.email : null,
        phone: typeof record.data.phone === "string" ? record.data.phone : null,
        currency: String(record.data.currency ?? "USD"),
        openingBalance: String(record.data.openingBalance ?? "0"),
        active: record.status !== "inactive",
        version: record.version,
        updatedBy: record.updatedBy,
        updatedAt: new Date(record.updatedAt),
        isDeleted: record.isDeleted,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
      }).where(and(eq(customers.id, record.id), eq(customers.companyId, record.companyId)))
      return record
    }
    if (record.module === "sales" && record.resource === "invoices") {
      await this.db.update(invoices).set({
        status: record.status,
        invoiceDate: new Date(String(record.data.invoiceDate)),
        dueDate: new Date(String(record.data.dueDate)),
        currency: String(record.data.currency),
        exchangeRate: String(record.data.exchangeRate ?? "1"),
        memo: typeof record.data.memo === "string" ? record.data.memo : null,
        subtotal: String(record.data.subtotal ?? record.data.total ?? "0"),
        discountTotal: String(record.data.discountTotal ?? "0"),
        taxTotal: String(record.data.taxTotal ?? "0"),
        total: String(record.data.total ?? "0"),
        amountPaid: String(record.data.amountPaid ?? "0"),
        balanceDue: String(record.data.balanceDue ?? record.data.total ?? "0"),
        version: record.version,
        updatedBy: record.updatedBy,
        updatedAt: new Date(record.updatedAt),
        isDeleted: record.isDeleted,
        deletedAt: record.deletedAt ? new Date(record.deletedAt) : null,
      }).where(and(eq(invoices.id, record.id), eq(invoices.companyId, record.companyId)))
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
}
