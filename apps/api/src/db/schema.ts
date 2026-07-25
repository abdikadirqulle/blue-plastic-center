import { boolean, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: text("legal_name").notNull(),
  functionalCurrency: text("functional_currency").notNull().default("USD"),
  active: boolean("active").notNull().default(true),
  ...auditColumns,
});

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  active: boolean("active").notNull().default(true),
  ...auditColumns,
}, (table) => [uniqueIndex("branches_company_code_uq").on(table.companyId, table.code)]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  active: boolean("active").notNull().default(true),
  ...auditColumns,
});

export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  parentId: uuid("parent_id"),
  accountNumber: text("account_number").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  currency: text("currency").notNull().default("USD"),
  active: boolean("active").notNull().default(true),
  ...auditColumns,
}, (table) => [uniqueIndex("accounts_company_number_uq").on(table.companyId, table.accountNumber)]);

export const accountingTransactions = pgTable("accounting_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  transactionNumber: text("transaction_number").notNull(),
  transactionDate: timestamp("transaction_date", { withTimezone: true }).notNull(),
  sourceModule: text("source_module").notNull(),
  sourceId: uuid("source_id"),
  status: text("status").notNull().default("draft"),
  currency: text("currency").notNull(),
  exchangeRate: numeric("exchange_rate", { precision: 20, scale: 8 }).notNull().default("1"),
  memo: text("memo"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  postedBy: uuid("posted_by").references(() => users.id),
  ...auditColumns,
}, (table) => [uniqueIndex("transactions_company_number_uq").on(table.companyId, table.transactionNumber)]);

export const accountingLines = pgTable("accounting_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  transactionId: uuid("transaction_id").notNull().references(() => accountingTransactions.id),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  description: text("description"),
  debit: numeric("debit", { precision: 20, scale: 4 }).notNull().default("0"),
  credit: numeric("credit", { precision: 20, scale: 4 }).notNull().default("0"),
  lineNumber: integer("line_number").notNull(),
}, (table) => [index("accounting_lines_transaction_idx").on(table.transactionId)]);

export const resourceRecords = pgTable("resource_records", {
  id: uuid("id").primaryKey(),
  module: text("module").notNull(),
  resource: text("resource").notNull(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  status: text("status").notNull().default("draft"),
  version: integer("version").notNull().default(1),
  data: jsonb("data").$type<Record<string, unknown>>().notNull(),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  updatedBy: uuid("updated_by").notNull().references(() => users.id),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...auditColumns,
}, (table) => [
  index("resource_records_tenant_lookup_idx").on(table.companyId, table.branchId, table.module, table.resource),
  index("resource_records_status_idx").on(table.companyId, table.status),
]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey(),
  requestId: text("request_id").notNull(),
  companyId: uuid("company_id").notNull().references(() => companies.id),
  branchId: uuid("branch_id").notNull().references(() => branches.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  changes: jsonb("changes").$type<Record<string, unknown>>(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("audit_events_tenant_time_idx").on(table.companyId, table.occurredAt)]);
