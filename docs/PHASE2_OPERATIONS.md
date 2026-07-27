# Phase 2 Operational API

Phase 2 uses a modular monolith. Every resource below receives the standard
secured CRUD contract:

```text
GET    /v1/:module/:resource
POST   /v1/:module/:resource
GET    /v1/:module/:resource/:id
PATCH  /v1/:module/:resource/:id
DELETE /v1/:module/:resource/:id
```

Create requests may include an `Idempotency-Key` header. Repeating an identical
request returns the original record; reusing the key with different data returns
HTTP 409. Updates require the current `version`. Deletes are soft deletes, and
posted records cannot be deleted.

All POST, PATCH, and DELETE requests require the HTTP-only session cookie and
`X-CSRF-Token`. Every mutation records an audit event.

## Sales

Resources:

- Customers
- Estimates
- Sales orders
- Invoices
- Customer payments and allocations
- Credit notes
- Cash sales / sales receipts
- Refund receipts
- Customer statements
- Customer deposits
- Recurring invoices

Workflows:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/v1/sales/estimates/:id/convert` | Estimate to sales order or invoice |
| POST | `/v1/sales/sales-orders/:id/convert` | Sales order to invoice |
| POST | `/v1/sales/payments/:id/allocate` | Allocate customer payment and create draft posting |
| POST | `/v1/sales/:resource/:id/email` | Queue document email |

## Purchasing

Resources:

- Vendors
- Purchase orders
- Item receipts
- Vendor bills
- Bill payments
- Vendor credits
- Expenses
- Purchase approvals
- Checks

Workflows:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/v1/purchasing/purchase-orders/:id/receive` | Partial or full PO receipt |
| POST | `/v1/purchasing/approvals/:id/decision` | Approve, reject, or request changes |

Approved bills create a balanced draft accounting posting through the internal
posting boundary.

## Inventory

Resources:

- Items and services
- Stock levels
- Warehouses
- Transfers
- Quantity/value adjustments
- Stock counts
- Assemblies and BOM builds
- Lots, serials, and expiry
- Reorder planning
- Pick, pack, and ship fulfillment
- Landed costs

Workflow:

```text
POST /v1/inventory/fulfillment/:id/action
draft -> allocated -> picked -> packed -> shipped
```

Invalid state changes return HTTP 409.

## Banking

Resources:

- Bank, cash, card, and mobile-money accounts
- Bank feed entries
- Bank transactions
- Matching rules
- Deposits
- Transfers
- Checks
- Reconciliations
- Cash-flow forecasts

Workflows:

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/v1/banking/bank-feeds/:id/action` | Match, add, or exclude feed entry |
| POST | `/v1/banking/reconciliation/:id/finish` | Finish only at zero difference |
| POST | `/v1/banking/bank-rules/:id/apply` | Apply a matching rule |

## Documents and background delivery

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/v1/documents/:module/:resource/:id/attachments` | Validate and initiate an attachment |
| POST | `/v1/documents/:module/:resource/:id/pdf` | Queue PDF generation |

Attachments are limited to approved content types and 10 MB. The API creates a
tenant-scoped storage key; binary object-storage upload is performed by the
storage adapter.

## Security matrix

- Administrator and Finance Manager: all operational modules
- Accountant: read/create/update/post across operational modules
- Sales: Sales and Debts only
- Purchasing: Purchasing only
- Warehouse: Inventory only
- Viewer: read-only

Module-specialized roles receive HTTP 403 outside their module even when the
requested action would otherwise be present in their role.
