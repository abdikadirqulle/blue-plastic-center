# Relational Data Migration

## Decision

Core accounting and operational records must use dedicated PostgreSQL tables.
`resource_records` is a transition store only and must not be the system of
record for production modules.

Every mutable business row is scoped to a company and, where operationally
relevant, a branch. It records `created_by`, `updated_by`, optimistic `version`,
soft-delete state, and timestamps. Transaction detail rows reference their
header with foreign keys and never duplicate tenant ownership.

## Migration strategy

Each slice follows the same expand-and-contract sequence:

1. Add dedicated tables, foreign keys, uniqueness rules, indexes and ownership.
2. Copy existing JSON records into typed columns without deleting the source.
3. Switch repository reads and writes to the relational tables.
4. Verify counts, totals, tenant isolation, CRUD, posting and soft deletion.
5. Disable generic writes for that slice.
6. Remove migrated generic rows only after a separately approved backup window.

## Table ownership

```text
companies
  ├── branches
  ├── users
  ├── customers
  │    ├── invoices
  │    │    └── invoice_lines
  │    └── customer_payments
  │         └── customer_payment_allocations
  ├── vendors
  ├── items
  ├── accounts
  ├── bank_accounts
  ├── projects
  └── employees
```

Users do not own accounting data personally. The company owns every record;
`created_by` and `updated_by` identify the responsible users for audit purposes.

## Delivery status

| Slice | Dedicated tables | Data migration | API switched | Generic writes disabled |
| --- | --- | --- | --- | --- |
| Company, branch, users | Yes | Native | Yes | Yes |
| General ledger | Yes | Native | Yes | Yes |
| Sales customers | Yes | Yes | Yes | Yes |
| Sales invoices and lines | Yes | Yes | Yes | Yes |
| Customer payments and allocations | Yes | Pending | Pending | Pending |
| Purchasing | Partial masters | Pending | Pending | Pending |
| Inventory | Partial masters | Pending | Pending | Pending |
| Banking | Pending | Pending | Pending | Pending |
| Projects | Pending | Pending | Pending | Pending |
| Payroll | Pending | Pending | Pending | Pending |
| Fixed assets and budgets | Pending | Pending | Pending | Pending |

`resource_records` must remain until every pending slice completes because the
current frontend still exposes those modules. Removing it earlier would cause
data loss and broken routes.
