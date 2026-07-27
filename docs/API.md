# BLUE PLASTIC CENTER API

## Runtime

- Base URL: `http://localhost:4000`
- Version prefix: `/v1`
- Content type: `application/json`
- Production database: PostgreSQL
- Development/test fallback: in-memory repository
- Framework: Fastify 5
- Validation: Zod

## Request context

Login creates an HTTP-only session cookie:

```http
POST /v1/auth/login
Content-Type: application/json

{"email":"admin@blueplastic.local","password":"Admin123!"}
```

The response includes a `csrfToken`. Send it as `X-CSRF-Token` for POST, PATCH,
PUT, and DELETE requests. Browsers must use `credentials: "include"` so the
HTTP-only `blue_session` cookie is sent.

Company, branch, user, and role are resolved from the database session. Clients
cannot choose their company or branch through request headers. `X-Request-Id`
is accepted or generated and returned for audit correlation.

Development seed credentials:

- Administrator: `admin@blueplastic.local` / `Admin123!`
- Accountant: `accountant@blueplastic.local` / `Accountant123!`
- Viewer: `viewer@blueplastic.local` / `Viewer123!`

Change all seeded passwords before storing real data.

## Standard envelopes

Success:

```json
{
  "data": {},
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 1,
    "totalPages": 1
  }
}
```

Error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Required fields are missing",
    "details": {
      "fields": ["displayName"]
    }
  }
}
```

## Platform endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness and version |
| POST | `/v1/auth/login` | Create a secure session |
| GET | `/v1/auth/me` | Current user and role |
| POST | `/v1/auth/logout` | Revoke the current session |
| GET | `/v1/auth/users` | List company users (Administrator) |
| POST | `/v1/auth/users` | Provision a company user (Administrator) |
| POST | `/v1/auth/users/:id/reset-password` | Reset password and revoke sessions |
| GET | `/v1/meta/modules` | Discover all modules, resources, and required fields |
| GET | `/v1/audit-events` | Tenant audit history |
| POST | `/v1/imports` | Validate or queue up to 5,000 import rows |
| POST | `/v1/reports/:kind/run` | Generate a parameterized financial/operational report |
| POST | `/v1/accounting/journal-entries/:id/post` | Validate and post a balanced journal |
| POST | `/v1/accounting/journal-entries/:id/reverse` | Post an equal-and-opposite reversal |
| POST | `/v1/accounting/periods/close` | Close a fiscal date range |
| POST | `/v1/accounting/periods/:name/reopen` | Reopen a period (Administrator only) |
| POST | `/v1/accounting/reconciliation/control-accounts` | Reconcile AR/AP subledgers to control accounts |
| POST | `/v1/projects/progress-billing/:id/create-invoice` | Convert progress billing into an invoice |
| GET | `/v1/projects/projects/:id/profitability` | Calculate project revenue, cost, and profit |
| POST | `/v1/payroll/pay-runs/:id/approve` | Approve a pay run and create its draft journal |
| POST | `/v1/payroll/pay-runs/:id/mark-paid` | Mark an approved pay run paid |
| GET | `/v1/trash` | List soft-deleted records (Administrator/Finance Manager) |
| POST | `/v1/trash/:id/restore` | Restore a soft-deleted record |

## Resource CRUD

All registered resources share the same contract:

| Method | Endpoint |
| --- | --- |
| GET | `/v1/:module/:resource` |
| POST | `/v1/:module/:resource` |
| GET | `/v1/:module/:resource/:id` |
| PATCH | `/v1/:module/:resource/:id` |
| DELETE | `/v1/:module/:resource/:id` |

List query parameters:

- `page` (default `1`)
- `pageSize` (default `25`, maximum `100`)
- `search`
- `status`
- `sort`: `createdAt` or `updatedAt`
- `order`: `asc` or `desc`

Create example:

```json
{
  "status": "active",
  "data": {
    "displayName": "Banaadir Trading Co.",
    "email": "accounts@banaadir.example"
  }
}
```

Update example:

```json
{
  "version": 1,
  "data": {
    "email": "finance@banaadir.example"
  }
}
```

The version must match the current record. A stale version returns HTTP `409`.
`DELETE` is always a soft delete: the row remains in PostgreSQL with
`is_deleted = true` and `deleted_at` populated, while ordinary list and detail
queries hide it. The API has no permanent-delete endpoint. Posted accounting
records return `409` and require a reversal or adjustment.

## Registered modules

- Setup: company settings, branches, currencies, tax codes, payment terms,
  document sequences, and opening balances
- Sales: invoices, customers, estimates, sales orders, payments, credit notes
- Debts: receivables, payables, payments
- Purchasing: bills, vendors, purchase orders, receipts, expenses, approvals
- Banking: accounts, transactions, reconciliation, transfers, cash flow
- Inventory: items, stock levels, warehouses, transfers, stock counts, assemblies
- Accounting: chart of accounts, journal entries, registers, recurring entries, fiscal periods, audit
- Projects: projects, tasks, time, expenses, progress billing, profitability
- Payroll: pay runs, employees, timesheets, leave, loans, reports

Detailed Phase 2 resource contracts, workflows, and permission boundaries are in
`docs/PHASE2_OPERATIONS.md`.

Ledger, period close, financial reports, project costing, and payroll workflows
are documented in `docs/PHASE3_FINANCE.md`.

## Database commands

```bash
npm run db:generate -w @blue-plastic/api
npm run db:migrate -w @blue-plastic/api
npm run db:seed -w @blue-plastic/api
npm run db:studio -w @blue-plastic/api
```
