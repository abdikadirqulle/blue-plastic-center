# Backend Delivery Plan

The system serves one company and approximately two to three users. Capacity can
remain modest, but integrity, authorization, auditability, backups, and posting
rules must remain production-grade.

## Phase 0 — Foundation (completed)

- Fastify application and graceful Node.js lifecycle
- Validated environment configuration
- Security headers, CORS, errors, and request context
- PostgreSQL/Drizzle connection, schema, migrations, and seed command
- Zod schemas, versioned REST routes, and response envelopes
- Repository/service boundaries with PostgreSQL and test adapters
- Tenant scope, RBAC foundation, audit events, optimistic locking, and soft delete
- API tests and backend documentation

Exit criteria: monorepo typecheck, lint, tests, and build pass; the API supports
memory storage for tests and PostgreSQL when `DATABASE_URL` is configured.

## Phase 1 — Identity, company setup, and core masters (completed)

- Database users, roles, sessions, password reset, and logout
- Password hashing, secure cookies, CSRF protection, and login throttling
- Company, branches, fiscal preferences, currencies, taxes, payment terms, and
  document-number sequences
- Customers, vendors, chart of accounts, items, warehouses, and opening balances
- Administrator, Accountant, and Viewer permission tests
- Backup, restore, readiness, and structured logging procedures

Exit criteria: demo tokens are removed; React uses secure sessions; master
records are persistent, validated, audited, and role-protected.

## Phase 2 — Operational accounting (completed)

- Estimates, sales orders, invoices, cash sales, receipts, credit notes, refunds,
  statements, deposits, and recurring sales
- Purchase orders, receipts, bills, vendor credits, expenses, and bill payments
- Inventory receipts, issues, transfers, adjustments, counts, assemblies, lots,
  serials, landed costs, reorder planning, and fulfillment
- Bank accounts, transfers, deposits, feeds, matching, and reconciliation
- Taxes, discounts, currency conversion, attachments, PDFs, and email jobs
- Idempotency keys and transactional document-number allocation

Exit criteria: operational frontend screens use real APIs; each approved
transaction creates balanced draft ledger entries atomically; critical
workflows have integration and rollback tests.

## Phase 3 — Ledger, close, reports, projects, and payroll

- Double-entry posting engine and subledger reconciliation
- Period locks, reversals, recurring journals, budgets, classes, and fixed assets
- Trial balance, ledger, P&L, balance sheet, cash flow, receivables, payables,
  inventory valuation, tax, and audit reports
- Project costing, time, expenses, progress billing, and profitability
- Employees, timesheets, leave, loans, benefits, pay runs, and liabilities
- Jobs, exports, retention, monitoring, and disaster-recovery verification

Exit criteria: control totals reconcile; closed periods reject changes;
financial reports match test fixtures; backup restoration and month-end close
are rehearsed.

## Recommended next work

Begin Phase 3 with the double-entry posting engine, fiscal-period controls, and
subledger reconciliation before expanding financial reports.
