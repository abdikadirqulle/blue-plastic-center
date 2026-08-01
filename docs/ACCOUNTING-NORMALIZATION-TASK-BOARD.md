# Accounting Normalization Task Board

## Objective

Replace generic JSONB persistence for financial modules with normalized,
tenant-safe relational aggregates and route every posted transaction through a
single double-entry accounting engine. Existing frontend routes and visual
design remain stable.

## Audit baseline

- Relational routing currently covers customers, invoices, items and accounts.
- Relational records are also written to `resource_records` as non-atomic
  shadow copies.
- Migration `0005` backfilled invoice headers but not invoice lines, customer
  payments or payment allocations.
- Payments, bills, expenses, receipts, credits, refunds, inventory movements
  and banking transactions still use JSONB.
- Operational workflows create draft journal resources but do not post to the
  ledger.
- Dashboard and several reports calculate from capped operational lists rather
  than reconciled ledger/subledger queries.
- The generic invoice form submits `incomplete`, computes authoritative totals
  with JavaScript numbers and does not send an idempotency key.
- Baseline before changes: typecheck passed; 76 Vitest tests passed. These tests
  do not yet prove PostgreSQL financial transaction safety.

## Execution board

| ID | Owner | Work | Depends on | Status | Required gate |
| --- | --- | --- | --- | --- | --- |
| A1 | Database architect | Expand accounts, journals, posting idempotency and migration quarantine schema | Audit | Code complete; staging gate pending | apply migrations to production-shaped DB |
| A2 | Database architect | Correct invoice-line/payment JSONB backfill without deleting legacy rows | A1 | Code complete; reconciliation pending | post-migration reconciliation queries |
| A3 | Accounting specialist | Strict journal validation, system-account resolver and transactional journal writer | A1 | Code complete; DB gate pending | PostgreSQL posting/race tests |
| S1 | Sales specialist | Typed normalized invoice repository/service/routes and server totals | A1, A3 | Service-invoice slice complete; DB gate pending | PostgreSQL CRUD/post rollback tests |
| I1 | Inventory specialist | Movement/balance tables, weighted-average costing and invoice COGS integration | A1, A3, S1 | Costing foundation complete; persistence pending | stock/value/idempotency tests |
| P1 | Sales specialist | Normalized customer payments and allocations | S1, A3 | Pending | partial/full/over-allocation tests |
| U1 | Frontend verifier | Canonical invoice/payment DTO adapters and real list/detail integration | S1, P1 | Pending | component + API contract tests |
| R1 | Reporting specialist | Ledger/subledger dashboard and reports | S1, I1, P1 | Registry safety complete; read models pending | reconciliation fixtures |
| B1 | Banking specialist | Normalized accounts/transfers/fees/reconciliation structures | A1, A3 | Transfer foundation complete; persistence pending | transfer accounting DB tests |
| V1 | Purchasing specialist | Bills, expenses, vendor payments and allocations | A1, A3, I1 | Pending | AP and inventory purchase tests |
| X1 | Accounting specialist | Atomic void/reversal workflows | S1, I1, P1, V1, B1 | Pending | reversal/closed-period tests |
| Q1 | QA/integration | Full quality gates and mandatory browser-to-report workflow | All | Pending | typecheck, lint, unit, integration, DB, E2E |

## JSONB cutover rules

1. Expand normalized schema without deleting legacy data.
2. Quarantine invalid legacy rows; never coerce invalid money or IDs to zero.
3. Backfill in dependency order and preserve source IDs when safe.
4. Reconcile counts, line totals, AR/AP, inventory and journal balance per
   company.
5. Switch explicit module reads, then writes, then dashboards/reports.
6. Disable generic financial writes and shadow merges only after reconciliation.
7. Archive legacy financial JSONB rows during a separately approved backup
   window. Unsupported non-financial resources may remain generic temporarily.

## Acceptance criteria

The release gate is the full invoice-to-payment workflow described in the
product requirements, including service/inventory behavior, balanced journals,
atomic rollback, idempotency, reversal, tenant isolation and reconciled P&L,
Balance Sheet, AR aging and inventory valuation. Compilation alone is not a
completion signal.

## A1/A2 verification record

- Migrations `0007_equal_doctor_strange.sql` and
  `0008_bouncy_blockbuster.sql` add stable company-scoped system
  account keys, journal source/fingerprint indexes, reversal foreign keys,
  posting idempotency, one-sided journal-line checks and migration quarantine.
- Legacy `resource_records` are retained. The migration backfills valid invoice
  lines, customer payments and payment allocations and records invalid or
  ambiguous records in `migration_exceptions` instead of coercing them.
- Drizzle schema consistency: `npm run db:check --workspace=@blue-plastic/api`.
- Schema and migration safety test: `tests/unit/accounting-schema.test.ts`.
- Apply and reconcile using the checklist in `MIGRATION-0007.md` before enabling
  normalized payment reads or writes.

## S1 implementation record

- Production invoice list/detail/create/update/post requests are routed through
  `InvoiceService` and `PostgresInvoiceRepository`; this path writes only
  `invoices`, `invoice_lines`, posting/audit tables and does not create a
  `resource_records` shadow copy.
- Draft totals are calculated server-side with scale-4 fixed-point arithmetic.
  Customer, branch, currency, item and income-account ownership is validated
  within the tenant before writes.
- Service invoices post AR and revenue through the transaction-scoped central
  ledger writer. The invoice status update, journal lines, posting idempotency
  claim and audit events share one PostgreSQL transaction.
- Inventory items are accepted on drafts but posting is deliberately rejected
  until I1 provides atomic stock and COGS movements. No inventory journal is
  synthesized without those movements.
- Pure unit coverage proves canonical draft validation and the balanced
  service-invoice AR/revenue journal. PostgreSQL rollback, concurrency and
  tenant-isolation integration gates still require a disposable test database;
  S1 remains in progress until those tests run successfully.

## Latest combined quality gate

- Typecheck and lint passed.
- Vitest passed: 131 tests across 24 files.
- API and web production builds passed.
- Drizzle schema check passed.
- The web build still reports the pre-existing large main-chunk/jsPDF import
  warning; it does not fail the build.
- Migrations and financial race/rollback tests still need a production-shaped
  PostgreSQL staging database before deployment approval.
