import { readFileSync } from "node:fs"
import { getTableConfig } from "drizzle-orm/pg-core"
import { describe, expect, it } from "vitest"
import {
  accountingLines,
  accountingTransactions,
  accounts,
  migrationExceptions,
  postingProfileLines,
  postingProfiles,
  postingIdempotencyKeys,
} from "../../src/db/schema.js"

const indexNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).indexes.map((index) => index.config.name)

const checkNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).checks.map((check) => check.name)

const columnNames = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).columns.map((column) => column.name)

describe("accounting database safety schema", () => {
  it("uses a tenant-unique stable key for system accounts", () => {
    expect(indexNames(accounts)).toContain("accounts_company_system_key_uq")
    expect(checkNames(accounts)).toContain("accounts_normal_balance_chk")
  })

  it("protects journal source posting and reversal lookups", () => {
    expect(indexNames(accountingTransactions)).toEqual(expect.arrayContaining([
      "transactions_company_posting_fingerprint_uq",
      "transactions_company_source_idx",
      "transactions_reversal_idx",
    ]))
    expect(checkNames(accountingTransactions)).toContain("transactions_status_chk")
  })

  it("requires one-sided non-negative journal lines", () => {
    expect(columnNames(accountingTransactions)).toContain("functional_currency")
    expect(columnNames(accountingLines)).toEqual(expect.arrayContaining([
      "functional_debit",
      "functional_credit",
    ]))
    expect(indexNames(accountingLines)).toContain("accounting_lines_transaction_number_uq")
    expect(checkNames(accountingLines)).toEqual(expect.arrayContaining([
      "accounting_lines_non_negative_chk",
      "accounting_lines_one_side_chk",
      "accounting_lines_functional_non_negative_chk",
      "accounting_lines_functional_one_side_chk",
    ]))
  })

  it("has posting idempotency and migration quarantine uniqueness", () => {
    expect(indexNames(postingIdempotencyKeys)).toEqual(expect.arrayContaining([
      "posting_idempotency_company_key_uq",
      "posting_idempotency_source_uq",
    ]))
    expect(indexNames(migrationExceptions)).toContain("migration_exceptions_source_reason_uq")
  })

  it("keeps posting profiles company-scoped without account-number policy", () => {
    expect(indexNames(postingProfiles)).toContain("posting_profiles_company_code_uq")
    expect(checkNames(postingProfiles)).toEqual(expect.arrayContaining([
      "posting_profiles_code_chk",
      "posting_profiles_version_chk",
    ]))
    expect(indexNames(postingProfileLines)).toEqual(expect.arrayContaining([
      "posting_profile_lines_role_uq",
      "posting_profile_lines_number_uq",
    ]))
    expect(checkNames(postingProfileLines)).toEqual(expect.arrayContaining([
      "posting_profile_lines_account_source_chk",
      "posting_profile_lines_meaning_chk",
      "posting_profile_lines_override_chk",
    ]))
    expect(getTableConfig(postingProfileLines).columns.map((column) => column.name))
      .not.toContain("account_number")
  })
})

describe("migration 0007 legacy cutover safety", () => {
  const migration = readFileSync(
    new URL("../../drizzle/0007_equal_doctor_strange.sql", import.meta.url),
    "utf8",
  )

  it("backfills invoice lines, payments and allocations", () => {
    expect(migration).toContain('INSERT INTO "invoice_lines"')
    expect(migration).toContain('INSERT INTO "customer_payments"')
    expect(migration).toContain('INSERT INTO "customer_payment_allocations"')
  })

  it("quarantines unsafe rows and retains the legacy source", () => {
    expect(migration).toContain('INSERT INTO "migration_exceptions"')
    expect(migration).not.toMatch(/DELETE\s+FROM\s+"resource_records"/i)
    expect(migration).not.toMatch(/DROP\s+TABLE\s+"resource_records"/i)
  })

  it("does not depend on PostgreSQL 16 input validation helpers", () => {
    expect(migration).not.toContain("pg_input_is_valid(")
    expect(migration).not.toMatch(/\bSELECT\s+SELECT\b/i)
  })

  it("quarantines unsafe allocations instead of hiding them", () => {
    expect(migration).toContain("PAYMENT_OVERALLOCATED")
    expect(migration).toContain("INVOICE_OVERALLOCATED")
    expect(migration).toContain("DUPLICATE_ALLOCATION")
    expect(migration).not.toMatch(/GREATEST\s*\(\s*payment\."amount"/i)
    expect(migration).not.toContain('UPDATE "invoices" invoice')
    expect(migration).toContain("Allocations are staged for the")
  })
})

describe("migration 0012 functional currency backfill", () => {
  const migration = readFileSync(
    new URL("../../drizzle/0012_yielding_lethal_legion.sql", import.meta.url),
    "utf8",
  )

  it("copies exact historical amounts before enforcing non-null columns", () => {
    expect(migration).toContain('"functional_debit" = "debit"')
    expect(migration).toContain('"functional_credit" = "credit"')
    expect(migration).toContain('company."functional_currency"')
    expect(migration.indexOf('SET "functional_debit" = "debit"'))
      .toBeLessThan(migration.indexOf('"functional_debit" SET NOT NULL'))
    expect(migration.indexOf('SET "functional_currency" = company."functional_currency"'))
      .toBeLessThan(migration.indexOf('"functional_currency" SET NOT NULL'))
  })
})
