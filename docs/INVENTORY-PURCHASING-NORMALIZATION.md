# Inventory and Purchasing Normalization Boundary

## Purpose

This document defines the relational boundary required for task-board items I1
and V1. It deliberately does not modify the active invoice/accounting migration.
All quantities and values use scale-4 decimal strings at API boundaries and
`numeric(20,4)` in PostgreSQL. Inventory carrying value is maintained in the
company functional currency; source-document currency and exchange rate remain
on the source document.

## Inventory tables required next

### `inventory_balances`

One current balance per tenant, warehouse, and item.

- `id uuid primary key`
- `company_id`, `branch_id`, `warehouse_id`, `item_id` foreign keys
- `quantity numeric(20,4) not null default 0`
- `inventory_value numeric(20,4) not null default 0`
- `average_unit_cost numeric(20,4) not null default 0`
- `revision integer not null default 0`
- audit timestamps
- unique `(company_id, warehouse_id, item_id)`
- checks: quantity/value/average cost non-negative; zero quantity requires zero
  value; revision non-negative

The stored average is a read optimization. The transaction writer must always
derive it from authoritative quantity and value using the shared costing engine.

### `inventory_movements`

Immutable stock/value subledger. Never update or soft-delete a posted movement;
correct it with a linked reversal movement.

- tenant keys: `company_id`, `branch_id`, `warehouse_id`, `item_id`
- `movement_number`, `movement_date`, `kind`, `status`
- signed `quantity_delta`, signed `value_delta`, and `unit_cost`
- post-movement `running_quantity`, `running_value`, `running_average_cost`
- `source_module`, `source_type`, `source_id`, **`source_line_id`**
- `idempotency_key`, `posting_fingerprint`
- `accounting_transaction_id`, `fiscal_period_id`
- `reversal_of_id`, `reversed_at`, `reversed_by`
- `created_by`, timestamps
- unique company/idempotency key and company/posting fingerprint
- unique source tuple `(company_id, source_module, source_type, source_id,
  source_line_id, kind)`
- checks for valid status/kind and non-zero quantity or value impact

`source_line_id` is mandatory for invoice, bill, receipt, assembly, and transfer
lines. Without it, an invoice containing the same item twice cannot be posted
idempotently.

### Optional reservation and transfer structures

- `inventory_reservations`: sales-order line, warehouse/item, reserved/fulfilled
  quantity, expiry, status. Available quantity is on-hand less active reserves.
- `inventory_transfers`: header with from/to warehouse, status and dates.
- `inventory_transfer_lines`: item, quantity and the linked outbound/inbound
  movement IDs. Both movement legs must carry the exact same value.

## Invoice integration requirement

`invoice_lines` needs nullable `warehouse_id`. It is required when the selected
item type is inventory and must be absent for account-only/service lines. Invoice
posting must run one database transaction that:

1. Locks the draft invoice and verifies its version and idempotency key.
2. Locks affected inventory balances in stable item/warehouse order.
3. Costs each inventory line as a `sale` movement.
4. Appends inventory movements and updates balances.
5. Posts AR/revenue plus COGS/inventory through the centralized accounting
   engine, using the inventory engine's authoritative `costApplied` values.
6. Marks the invoice posted only after every subledger and ledger write succeeds.

Service lines generate revenue but no inventory movement or COGS entry. Negative
stock is rejected unless a future explicit company policy enables it.

## Purchasing tables required next

### Purchase and receipt aggregates

- `purchase_orders` and `purchase_order_lines`: normalized approval/ordering
  documents with vendor, branch, currency, dates, warehouse/item/account,
  quantity ordered/received, unit cost, and status.
- `goods_receipts` and `goods_receipt_lines`: vendor/PO, receipt date, warehouse,
  item, quantity, accepted/rejected quantity, unit cost, source currency and
  functional value. Each inventory line links to its inventory movement.

Receiving inventory creates the stock movement. A later bill must not receive
the same stock again; it clears goods-received-not-invoiced (GRNI) or records a
purchase-price variance.

### Bill and AP aggregates

- `bills`: company/branch/vendor, bill number and vendor reference, bill/due
  dates, currency/exchange rate, AP account, status, subtotal/discount/total,
  amount paid/balance due, version, audit and soft-delete fields for drafts only.
- `bill_lines`: bill, line number, item/account/warehouse/receipt-line links,
  description, quantity, unit cost, discount, line total, functional line value.
- `vendor_payments`: company/branch/vendor, payment number/date, currency/rate,
  amount/unapplied amount, bank account, method/reference, status and version.
- `vendor_payment_allocations`: payment/bill, applied amount, unique pair.
- `vendor_credits`, `vendor_credit_lines`, and credit allocations with the same
  normalized line and balance rules.

Required uniqueness is company-scoped. Every relation must be tenant-checked in
repository queries rather than trusting a foreign-key UUID received from the
client.

## Transaction and service boundaries

- `InventoryCostingService` is pure fixed-point domain logic (implemented in
  `inventory-costing.ts`).
- `InventoryLedgerRepository` will lock balances, enforce idempotency, append
  immutable movements, and perform optimistic revision updates atomically.
- `InventoryPostingService` coordinates source documents, inventory repository,
  and the centralized accounting posting port in one PostgreSQL transaction.
- `PurchasingRepository` owns bill/receipt/payment aggregates and uses explicit
  DTOs; it must not read or write generic `resource_records.data`.
- `PurchasingPostingService` coordinates AP, GRNI/inventory/expense, payment and
  allocation entries through that same transaction boundary.

## Required verification gates

- Weighted-average receipt, partial issue, final depletion, transfer-value
  conservation, landed-cost and decimal precision tests.
- PostgreSQL concurrency test proving two simultaneous issues cannot oversell.
- Idempotent replay and same-key/different-payload conflict tests.
- Atomic invoice rollback when inventory or accounting posting fails.
- Bill/receipt three-way matching, partial/full vendor payment, over-allocation,
  tenant isolation, closed-period and reversal tests.
- Reconciliation per company: movement sum equals every balance, inventory
  valuation equals the inventory-control GL account, and AP open bills equal the
  AP-control GL account.
