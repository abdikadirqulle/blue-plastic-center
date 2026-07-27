# Phase 3 — Finance, Projects, and Payroll

Phase 3 adds the controlled general-ledger boundary and the accounting workflows
that must not be implemented as ordinary CRUD status changes.

## General ledger

- Journal values use fixed four-decimal arithmetic.
- `POST /v1/accounting/journal-entries/:id/post` resolves every account, verifies
  equal non-zero debits and credits, checks the fiscal lock, and writes the
  transaction, lines, source reference, posting actor, and audit event in one
  PostgreSQL transaction.
- Posted journals are immutable.
- `POST /v1/accounting/journal-entries/:id/reverse` creates and posts an
  equal-and-opposite journal linked to its source.
- `POST /v1/accounting/periods/close` closes a named date range.
- `POST /v1/accounting/periods/:name/reopen` is restricted to Administrators.

The seeded control accounts are:

| Number | Account |
| --- | --- |
| 1000 | Cash and Bank |
| 1100 | Accounts Receivable |
| 1200 | Inventory |
| 2000 | Accounts Payable |
| 2100 | Payroll Payable |
| 3000 | Owner's Equity |
| 4000 | Sales Revenue |
| 5000 | Cost of Goods Sold |
| 6000 | Operating Expenses |

## Financial reports

`POST /v1/reports/:kind/run` accepts `from`, `to`, `basis`, and `currency`.
Supported ledger-derived reports are `trial-balance`, `general-ledger`,
`profit-and-loss`, `balance-sheet`, and `cash-flow`. Operational reports include
`receivables-aging`, `payables-aging`, `inventory-valuation`, `tax-summary`, and
`audit-trail`. Ledger results contain reproducible debit/credit control totals.

`POST /v1/accounting/reconciliation/control-accounts` compares receivables and
payables subledger totals against accounts 1100 and 2000 and returns variances.

## Projects

All project resources have dedicated Zod contracts. Progress billing creates a
draft sales invoice through:

`POST /v1/projects/progress-billing/:id/create-invoice`

Project profitability is generated at:

`GET /v1/projects/projects/:id/profitability`

Revenue, labour cost, direct expense, total cost, profit, and margin are
calculated with fixed-decimal arithmetic.

## Payroll

Pay-run lines require `net pay = gross pay - deductions`. Period dates and
payment dates are validated.

- `POST /v1/payroll/pay-runs/:id/approve` secures the approval transition and
  creates a balanced draft payroll journal.
- `POST /v1/payroll/pay-runs/:id/mark-paid` only accepts an approved pay run.

Employees, timesheets, leave, loans, liabilities, benefits, and payroll report
requests use dedicated schemas and tenant-scoped CRUD.

## Production checklist

1. Apply migration `0003_neat_blazing_skull.sql`.
2. Run the seed to create the base chart of accounts and FY 2026.
3. Replace all seed passwords before real use.
4. Have a qualified accountant approve the account mapping and opening balances.
5. Rehearse close, reversal, database backup, and restore before launch.
