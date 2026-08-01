import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  check,
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

const ownedRecordColumns = () => ({
  branchId: uuid("branch_id").references(() => branches.id),
  version: integer("version").notNull().default(1),
  createdBy: uuid("created_by").references(() => users.id),
  updatedBy: uuid("updated_by").references(() => users.id),
  isDeleted: boolean("is_deleted").notNull().default(false),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  ...auditColumns,
})

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
  username: text("username").notNull().unique(),
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
    ...ownedRecordColumns(),
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
    ...ownedRecordColumns(),
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
    ...ownedRecordColumns(),
  },
  (table) => [uniqueIndex("items_company_sku_uq").on(table.companyId, table.sku)],
)

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    invoiceNumber: text("invoice_number").notNull(),
    invoiceDate: timestamp("invoice_date", { withTimezone: true }).notNull(),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    currency: text("currency").notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 20, scale: 8 }).notNull().default("1"),
    status: text("status").notNull().default("draft"),
    customerPurchaseOrder: text("customer_purchase_order"),
    memo: text("memo"),
    subtotal: numeric("subtotal", { precision: 20, scale: 4 }).notNull().default("0"),
    discountTotal: numeric("discount_total", { precision: 20, scale: 4 }).notNull().default("0"),
    taxTotal: numeric("tax_total", { precision: 20, scale: 4 }).notNull().default("0"),
    total: numeric("total", { precision: 20, scale: 4 }).notNull().default("0"),
    amountPaid: numeric("amount_paid", { precision: 20, scale: 4 }).notNull().default("0"),
    balanceDue: numeric("balance_due", { precision: 20, scale: 4 }).notNull().default("0"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: uuid("voided_by").references(() => users.id),
    voidReason: text("void_reason"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    updatedBy: uuid("updated_by").notNull().references(() => users.id),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("invoices_company_number_uq").on(table.companyId, table.invoiceNumber),
    index("invoices_company_customer_idx").on(table.companyId, table.customerId),
    index("invoices_company_due_idx").on(table.companyId, table.dueDate),
    index("invoices_company_status_idx").on(table.companyId, table.status, table.invoiceDate),
    check(
      "invoices_status_chk",
      sql`${table.status} in ('draft', 'open', 'partially_paid', 'paid', 'overdue', 'voided')`,
    ),
  ],
)

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    itemId: uuid("item_id").references(() => items.id),
    accountId: uuid("account_id").references(() => accounts.id),
    taxCodeId: uuid("tax_code_id").references(() => taxCodes.id),
    warehouseId: uuid("warehouse_id").references(() => warehouses.id),
    description: text("description").notNull(),
    unit: text("unit"),
    quantity: numeric("quantity", { precision: 20, scale: 4 }).notNull().default("1"),
    unitPrice: numeric("unit_price", { precision: 20, scale: 4 }).notNull().default("0"),
    discountAmount: numeric("discount_amount", { precision: 20, scale: 4 }).notNull().default("0"),
    taxRate: numeric("tax_rate", { precision: 9, scale: 4 }).notNull().default("0"),
    taxAmount: numeric("tax_amount", { precision: 20, scale: 4 }).notNull().default("0"),
    lineTotal: numeric("line_total", { precision: 20, scale: 4 }).notNull().default("0"),
    lineNumber: integer("line_number").notNull(),
  },
  (table) => [
    uniqueIndex("invoice_lines_invoice_number_uq").on(table.invoiceId, table.lineNumber),
    index("invoice_lines_invoice_idx").on(table.invoiceId),
  ],
)

export const customerPayments = pgTable(
  "customer_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    customerId: uuid("customer_id").notNull().references(() => customers.id),
    paymentNumber: text("payment_number").notNull(),
    paymentDate: timestamp("payment_date", { withTimezone: true }).notNull(),
    currency: text("currency").notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 20, scale: 8 }).notNull().default("1"),
    amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),
    unappliedAmount: numeric("unapplied_amount", { precision: 20, scale: 4 }).notNull().default("0"),
    paymentMethod: text("payment_method"),
    reference: text("reference"),
    depositAccountId: uuid("deposit_account_id").references(() => accounts.id),
    status: text("status").notNull().default("draft"),
    version: integer("version").notNull().default(1),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    updatedBy: uuid("updated_by").notNull().references(() => users.id),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("customer_payments_company_number_uq").on(table.companyId, table.paymentNumber),
    index("customer_payments_customer_idx").on(table.companyId, table.customerId),
  ],
)

export const customerPaymentAllocations = pgTable(
  "customer_payment_allocations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paymentId: uuid("payment_id").notNull().references(() => customerPayments.id),
    invoiceId: uuid("invoice_id").notNull().references(() => invoices.id),
    amount: numeric("amount", { precision: 20, scale: 4 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("payment_allocations_payment_invoice_uq").on(table.paymentId, table.invoiceId),
  ],
)

export const inventoryBalances = pgTable(
  "inventory_balances",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    itemId: uuid("item_id").notNull().references(() => items.id),
    quantity: numeric("quantity", { precision: 20, scale: 4 }).notNull().default("0"),
    inventoryValue: numeric("inventory_value", { precision: 20, scale: 4 }).notNull().default("0"),
    revision: integer("revision").notNull().default(0),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("inventory_balances_scope_uq").on(
      table.companyId,
      table.warehouseId,
      table.itemId,
    ),
    check(
      "inventory_balances_non_negative_chk",
      sql`${table.quantity} >= 0 and ${table.inventoryValue} >= 0`,
    ),
  ],
)

/**
 * Append-only stock ledger. One row per affected document line; the source
 * unique index is what stops a retried post from moving stock twice.
 */
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    branchId: uuid("branch_id").notNull().references(() => branches.id),
    warehouseId: uuid("warehouse_id").notNull().references(() => warehouses.id),
    itemId: uuid("item_id").notNull().references(() => items.id),
    kind: text("kind").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    sourceModule: text("source_module").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    sourceLineId: uuid("source_line_id"),
    idempotencyKey: text("idempotency_key").notNull(),
    quantityDelta: numeric("quantity_delta", { precision: 20, scale: 4 }).notNull(),
    valueDelta: numeric("value_delta", { precision: 20, scale: 4 }).notNull(),
    unitCost: numeric("unit_cost", { precision: 20, scale: 4 }).notNull().default("0"),
    quantityAfter: numeric("quantity_after", { precision: 20, scale: 4 }).notNull(),
    valueAfter: numeric("value_after", { precision: 20, scale: 4 }).notNull(),
    createdBy: uuid("created_by").notNull().references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("inventory_movements_source_uq").on(
      table.companyId,
      table.sourceModule,
      table.sourceType,
      table.sourceId,
      table.idempotencyKey,
    ),
    index("inventory_movements_item_idx").on(
      table.companyId,
      table.itemId,
      table.warehouseId,
      table.occurredAt,
    ),
    index("inventory_movements_source_idx").on(
      table.companyId,
      table.sourceModule,
      table.sourceType,
      table.sourceId,
    ),
  ],
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
    subtype: text("subtype"),
    systemKey: text("system_key"),
    normalBalance: text("normal_balance").notNull().default("debit"),
    isSystem: boolean("is_system").notNull().default(false),
    isControlAccount: boolean("is_control_account").notNull().default(false),
    allowManualPosting: boolean("allow_manual_posting").notNull().default(true),
    currency: text("currency").notNull().default("USD"),
    active: boolean("active").notNull().default(true),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("accounts_company_number_uq").on(
      table.companyId,
      table.accountNumber,
    ),
    uniqueIndex("accounts_company_system_key_uq")
      .on(table.companyId, table.systemKey)
      .where(sql`${table.systemKey} is not null`),
    index("accounts_company_type_active_idx").on(table.companyId, table.type, table.active),
    check("accounts_normal_balance_chk", sql`${table.normalBalance} in ('debit', 'credit')`),
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
    sourceType: text("source_type").notNull().default("journal"),
    sourceId: uuid("source_id"),
    postingKind: text("posting_kind").notNull().default("primary"),
    postingFingerprint: text("posting_fingerprint"),
    idempotencyKey: text("idempotency_key"),
    fiscalPeriodId: uuid("fiscal_period_id").references(() => fiscalPeriods.id),
    reversalOfId: uuid("reversal_of_id").references(
      (): AnyPgColumn => accountingTransactions.id,
      { onDelete: "restrict" },
    ),
    status: text("status").notNull().default("draft"),
    currency: text("currency").notNull(),
    exchangeRate: numeric("exchange_rate", { precision: 20, scale: 8 })
      .notNull()
      .default("1"),
    memo: text("memo"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    postedBy: uuid("posted_by").references(() => users.id),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
    reversedBy: uuid("reversed_by").references(() => users.id),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("transactions_company_number_uq").on(
      table.companyId,
      table.transactionNumber,
    ),
    uniqueIndex("transactions_company_posting_fingerprint_uq")
      .on(table.companyId, table.postingFingerprint)
      .where(sql`${table.postingFingerprint} is not null`),
    index("transactions_company_source_idx").on(
      table.companyId,
      table.sourceModule,
      table.sourceType,
      table.sourceId,
      table.postingKind,
    ),
    index("transactions_reversal_idx").on(table.reversalOfId),
    check("transactions_status_chk", sql`${table.status} in ('draft', 'posted', 'reversed', 'voided')`),
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
    uniqueIndex("accounting_lines_transaction_number_uq").on(table.transactionId, table.lineNumber),
    check("accounting_lines_non_negative_chk", sql`${table.debit} >= 0 and ${table.credit} >= 0`),
    check(
      "accounting_lines_one_side_chk",
      sql`(${table.debit} > 0 and ${table.credit} = 0) or (${table.credit} > 0 and ${table.debit} = 0)`,
    ),
  ],
)

export const postingIdempotencyKeys = pgTable(
  "posting_idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "restrict" }),
    key: text("key").notNull(),
    requestHash: text("request_hash").notNull(),
    sourceModule: text("source_module").notNull(),
    sourceType: text("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    postingKind: text("posting_kind").notNull().default("primary"),
    transactionId: uuid("transaction_id").references(() => accountingTransactions.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("processing"),
    response: jsonb("response").$type<Record<string, unknown>>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by").notNull().references(() => users.id, { onDelete: "restrict" }),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("posting_idempotency_company_key_uq").on(table.companyId, table.key),
    uniqueIndex("posting_idempotency_source_uq").on(
      table.companyId,
      table.sourceModule,
      table.sourceType,
      table.sourceId,
      table.postingKind,
    ),
    index("posting_idempotency_expiry_idx").on(table.expiresAt),
    check("posting_idempotency_status_chk", sql`${table.status} in ('processing', 'completed', 'failed')`),
  ],
)

export const migrationExceptions = pgTable(
  "migration_exceptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    migrationTag: text("migration_tag").notNull(),
    sourceTable: text("source_table").notNull(),
    sourceId: text("source_id").notNull(),
    companyId: uuid("company_id").references(() => companies.id, { onDelete: "restrict" }),
    module: text("module"),
    resource: text("resource"),
    reasonCode: text("reason_code").notNull(),
    reason: text("reason").notNull(),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("migration_exceptions_source_reason_uq").on(
      table.migrationTag,
      table.sourceTable,
      table.sourceId,
      table.reasonCode,
    ),
    index("migration_exceptions_open_idx").on(table.migrationTag, table.resolvedAt),
    index("migration_exceptions_company_idx").on(table.companyId, table.detectedAt),
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
