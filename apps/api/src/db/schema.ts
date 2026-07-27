import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

const auditColumns = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: text("legal_name").notNull(),
  functionalCurrency: text("functional_currency").notNull().default("USD"),
  active: boolean("active").notNull().default(true),
  ...auditColumns,
})

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    name: text("name").notNull(),
    code: text("code").notNull(),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("branches_company_code_uq").on(table.companyId, table.code),
  ],
)

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").references(() => companies.id),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull(),
  passwordHash: text("password_hash"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  ...auditColumns,
})

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    csrfTokenHash: text("csrf_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("sessions_token_hash_uq").on(table.tokenHash),
    index("sessions_user_expiry_idx").on(table.userId, table.expiresAt),
  ],
)

export const companySettings = pgTable("company_settings", {
  companyId: uuid("company_id").primaryKey().references(() => companies.id, { onDelete: "cascade" }),
  tradingName: text("trading_name"),
  taxRegistrationNumber: text("tax_registration_number"),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
  accountingBasis: text("accounting_basis").notNull().default("accrual"),
  timezone: text("timezone").notNull().default("Africa/Mogadishu"),
  dateFormat: text("date_format").notNull().default("dd/MM/yyyy"),
  ...auditColumns,
})

export const currencies = pgTable(
  "currencies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    symbol: text("symbol").notNull(),
    decimalPlaces: integer("decimal_places").notNull().default(2),
    exchangeRate: numeric("exchange_rate", { precision: 20, scale: 8 }).notNull().default("1"),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [uniqueIndex("currencies_company_code_uq").on(table.companyId, table.code)],
)

export const taxCodes = pgTable(
  "tax_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    rate: numeric("rate", { precision: 9, scale: 6 }).notNull(),
    salesAccountId: uuid("sales_account_id").references(() => accounts.id),
    purchaseAccountId: uuid("purchase_account_id").references(() => accounts.id),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [uniqueIndex("tax_codes_company_code_uq").on(table.companyId, table.code)],
)

export const paymentTerms = pgTable(
  "payment_terms",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    dueDays: integer("due_days").notNull().default(0),
    discountDays: integer("discount_days"),
    discountRate: numeric("discount_rate", { precision: 9, scale: 6 }),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [uniqueIndex("payment_terms_company_name_uq").on(table.companyId, table.name)],
)

export const documentSequences = pgTable(
  "document_sequences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    documentType: text("document_type").notNull(),
    prefix: text("prefix").notNull().default(""),
    nextNumber: integer("next_number").notNull().default(1),
    padding: integer("padding").notNull().default(5),
    ...auditColumns,
  },
  (table) => [uniqueIndex("document_sequences_company_type_uq").on(table.companyId, table.documentType)],
)

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    displayName: text("display_name").notNull(),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    currency: text("currency").notNull().default("USD"),
    paymentTermId: uuid("payment_term_id").references(() => paymentTerms.id),
    receivableAccountId: uuid("receivable_account_id").references(() => accounts.id),
    openingBalance: numeric("opening_balance", { precision: 20, scale: 4 }).notNull().default("0"),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [index("customers_company_name_idx").on(table.companyId, table.displayName)],
)

export const vendors = pgTable(
  "vendors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    displayName: text("display_name").notNull(),
    companyName: text("company_name"),
    email: text("email"),
    phone: text("phone"),
    currency: text("currency").notNull().default("USD"),
    paymentTermId: uuid("payment_term_id").references(() => paymentTerms.id),
    payableAccountId: uuid("payable_account_id").references(() => accounts.id),
    openingBalance: numeric("opening_balance", { precision: 20, scale: 4 }).notNull().default("0"),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [index("vendors_company_name_idx").on(table.companyId, table.displayName)],
)

export const warehouses = pgTable(
  "warehouses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    branchId: uuid("branch_id").references(() => branches.id),
    code: text("code").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [uniqueIndex("warehouses_company_code_uq").on(table.companyId, table.code)],
)

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    salesPrice: numeric("sales_price", { precision: 20, scale: 4 }).notNull().default("0"),
    purchaseCost: numeric("purchase_cost", { precision: 20, scale: 4 }).notNull().default("0"),
    incomeAccountId: uuid("income_account_id").references(() => accounts.id),
    expenseAccountId: uuid("expense_account_id").references(() => accounts.id),
    inventoryAccountId: uuid("inventory_account_id").references(() => accounts.id),
    taxCodeId: uuid("tax_code_id").references(() => taxCodes.id),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [uniqueIndex("items_company_sku_uq").on(table.companyId, table.sku)],
)

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    resourceRecordId: uuid("resource_record_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("idempotency_keys_company_key_uq").on(table.companyId, table.key)],
)

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    resourceRecordId: uuid("resource_record_id").notNull(),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    storageKey: text("storage_key").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedBy: uuid("uploaded_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("attachments_resource_idx").on(table.companyId, table.resourceRecordId)],
)

export const backgroundJobs = pgTable(
  "background_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    type: text("type").notNull(),
    status: text("status").notNull().default("queued"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    result: jsonb("result").$type<Record<string, unknown>>(),
    attempts: integer("attempts").notNull().default(0),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("background_jobs_status_idx").on(table.status, table.scheduledAt)],
)

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    parentId: uuid("parent_id"),
    accountNumber: text("account_number").notNull(),
    name: text("name").notNull(),
    type: text("type").notNull(),
    currency: text("currency").notNull().default("USD"),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("accounts_company_number_uq").on(
      table.companyId,
      table.accountNumber,
    ),
  ],
)

export const fiscalPeriods = pgTable(
  "fiscal_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    name: text("name").notNull(),
    startDate: timestamp("start_date", { withTimezone: true }).notNull(),
    endDate: timestamp("end_date", { withTimezone: true }).notNull(),
    status: text("status").notNull().default("open"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: uuid("closed_by").references(() => users.id),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("fiscal_periods_company_name_uq").on(table.companyId, table.name),
    index("fiscal_periods_company_dates_idx").on(table.companyId, table.startDate, table.endDate),
  ],
)

export const accountingTransactions = pgTable(
  "accounting_transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    transactionNumber: text("transaction_number").notNull(),
    transactionDate: timestamp("transaction_date", {
      withTimezone: true,
    }).notNull(),
    sourceModule: text("source_module").notNull(),
    sourceId: uuid("source_id"),
    fiscalPeriodId: uuid("fiscal_period_id").references(() => fiscalPeriods.id),
    reversalOfId: uuid("reversal_of_id"),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 20, scale: 8 })
      .notNull()
      .default("1"),
    memo: text("memo"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("transactions_company_number_uq").on(
      table.companyId,
      table.transactionNumber,
    ),
  ],
)

export const accountingLines = pgTable(
  "accounting_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transactionId: uuid("transaction_id")
      .notNull()
      .references(() => accountingTransactions.id),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id),
    description: text("description"),
    debit: numeric("debit", { precision: 20, scale: 4 }).notNull().default("0"),
    credit: numeric("credit", { precision: 20, scale: 4 })
      .notNull()
      .default("0"),
    lineNumber: integer("line_number").notNull(),
  },
  (table) => [
    index("accounting_lines_transaction_idx").on(table.transactionId),
  ],
)

export const resourceRecords = pgTable(
  "resource_records",
  {
    id: uuid("id").primaryKey(),
    module: text("module").notNull(),
    resource: text("resource").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    data: jsonb("data").$type<Record<string, unknown>>().notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => users.id),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    index("resource_records_tenant_lookup_idx").on(
      table.companyId,
      table.branchId,
      table.module,
      table.resource,
    ),
    index("resource_records_status_idx").on(table.companyId, table.status),
    index("resource_records_deleted_idx").on(table.companyId, table.isDeleted),
  ],
)

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey(),
    requestId: text("request_id").notNull(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    changes: jsonb("changes").$type<Record<string, unknown>>(),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("audit_events_tenant_time_idx").on(table.companyId, table.occurredAt),
  ],
)
