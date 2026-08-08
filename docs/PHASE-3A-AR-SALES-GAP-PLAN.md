# Phase 3A — AR / Sales Gap Plan

**Status:** Targeted current-state assessment
**Scope:** Active AR/Sales accounting paths only
**Decision:** Reuse the relational invoice and payment schema, then cut the active
payment path over from `resource_records` before adding further Sales features.

## 1. Executive Verdict

The invoice vertical slice is already the correct nucleus: `invoices` and
`invoice_lines` are relational; drafts have no accounting effect; posting calls
the canonical ledger with `postInTransaction()`; and voiding preserves the
original journal and creates a reversal. This path should be kept.

AR as a whole is not yet coherent. Customer payments and allocations have
relational tables, but active API writes, reads, balance calculations, and
posting still use `resource_records` JSON. Payment state is updated before a
separate GL call, invoice settlement columns are not updated, and allocations
are inferred by read models. Sales receipts are also generic JSON records and
can post GL while still marked draft. The smallest safe next step is therefore
to activate and harden the existing relational payment/allocation foundation,
not redesign invoices or the Accounting Core.

## 2. Current AR/Sales Flow

### Invoice / credit sale

```text
POST /sales/invoices
  -> InvoiceService.create
  -> PostgresInvoiceRepository.create
  -> invoices + invoice_lines (draft; calculated exact totals)

POST /sales/invoices/:id/post
  -> InvoiceService.post
  -> PostgresInvoiceRepository.post (one DB transaction)
  -> optional inventory movement
  -> buildInvoicePosting
  -> LedgerRepository.postInTransaction
  -> invoice draft -> open + audit
```

- Tables: `invoices`, `invoice_lines`; customers come from `customers`.
- Lifecycle: `draft` then `open`; projected settlement states are
  `partially_paid`, `paid`, or `overdue`; `voided` is the correction state
  (`invoice-domain.ts`).
- GL: debit AR; credit revenue/tax; stocked lines also debit COGS and credit
  inventory (`invoice-posting.ts`).
- Accounting Core: canonical Posting Engine, AccountResolver, exact Money,
  fiscal-period enforcement, and caller-owned transaction are used through
  `PostgresInvoiceRepository.post()`.
- Persistence: relational. `ResourceService` delegates invoices to the invoice
  repository and does not use the generic store (`resource-service.ts`).

### Customer payment

```text
POST /sales/payments
  -> ResourceService.create
  -> resource_records (draft JSON)

POST /sales/payments/:id/allocate
  -> read JSON payment
  -> update JSON allocations + status "applied"
  -> LedgerRepository.post (separate transaction)
  -> Dr Bank / Cr AR
```

- Active table: `resource_records`, despite `customer_payments` and
  `customer_payment_allocations` existing in `db/schema.ts`.
- Lifecycle: generic `draft -> applied`; there is no domain-owned payment
  lifecycle service.
- GL: canonical ledger entry point is used, but not `postInTransaction()` and
  not in the same transaction as payment/allocation state (`sales.routes.ts`).
- Allocation remains JSON in the active path.

### Sales receipt / cash sale

```text
POST /sales/sales-receipts
  -> ResourceService.create
  -> resource_records
  -> ResourceService.postCashSale
  -> LedgerRepository.post (separate transaction)
  -> Dr configured deposit/bank / Cr sales revenue
```

- Active table: `resource_records`; no relational receipt/line aggregate.
- Lifecycle: generic record status. There is no explicit post transition.
- GL: canonical ledger is used, but the document and journal are not atomic.
- `postCashSale()` posts on create without requiring posted/paid status and
  silently does nothing when amount/ledger is absent (`resource-service.ts`).

### Customer balance

`RecordReadModel.withCustomerBalances()` and `customerActivity()` combine:

1. relational invoices from `InvoiceRepository.listByCustomers()`;
2. JSON payments from `resource_records`;
3. JSON allocation arrays reduced by `allocationsByDocument()`; and
4. status heuristics in `balance-math.ts` / `record-read-model.ts`.

The displayed balance is not GL-derived and does not use the relational payment
tables. The customer's stored `openingBalance` is exposed on the master record
but is not included in this balance calculation.

## 3. Current Sources of Truth

Today, “Customer X owes Company Y amount Z from Invoice N” has competing
representations:

- `invoices.total`, `amount_paid`, and `balance_due` are relational stored facts;
- payment allocations are active JSON under `resource_records.data.allocations`;
- read models recalculate a lower open amount from those JSON allocations;
- customer `opening_balance` is mutable master data but is omitted from the AR
  read-model total; and
- the AR control-account balance exists independently in GL.

The closest reliable source is a **posted relational invoice**, but its open
amount is not authoritative after payment because the active allocation path
does not update `amount_paid` / `balance_due`. This is split-brain behavior.
There is currently no single relational query that proves the complete
customer/invoice/payment/allocation obligation.

## 4. Draft vs Posted Violations

- **Invoice:** correct in its domain path. Creation persists only draft data;
  tests confirm no ledger effect, and customer balances exclude drafts
  (`invoice-workflow.test.ts`, `record-read-model.test.ts`).
- **Sales reports:** `report.routes.ts` aggregates every invoice returned for
  sales-by-item and sales-by-customer without excluding drafts. Drafts can
  therefore affect financial-looking sales totals and balances.
- **Payment eligibility:** `/payments/:id/allocate` does not prove that the
  target invoice is posted, belongs to the payment customer/company, remains
  open, or has sufficient balance (`sales.routes.ts`).
- **Sales receipt:** `ResourceService.create()` invokes `postCashSale()` for a
  newly saved sales receipt regardless of status. A draft can therefore create
  GL revenue/cash while the generic document remains draft.

## 5. Customer Payment & Allocation State

Relational tables exist:

- `customer_payments`: company, branch, customer, exact numeric amount,
  currency/rate, deposit account, status, unapplied amount, version, and audit
  ownership fields;
- `customer_payment_allocations`: payment ID, invoice ID, and exact numeric
  amount, with one row per payment/invoice pair.

Migration `0007_equal_doctor_strange.sql` staged valid legacy payments and
allocations into these tables, deliberately leaving payments draft until a real
atomic posting workflow exists. Runtime repositories/services do not use them.

The JSON workflow can visually represent partial payments, multiple payments
per invoice, and one payment across invoices, but it does not enforce their
accounting validity. Unapplied credit is inferred as payment minus JSON
allocations rather than persisted through an atomic posted payment fact.

## 6. Balance Semantics

Current invoice open balance is effectively:

```text
min(invoices.balance_due, invoices.total - posted-ish JSON allocations)
```

Current customer balance is effectively:

```text
sum(non-draft, non-void invoice open amounts)
- sum(non-draft JSON payment amounts not represented by JSON allocations)
```

This avoids some double counting but relies on generic statuses: any payment
status other than draft/void-like is treated as posted. It is not a durable AR
subledger formula. `invoices.amount_paid` and `balance_due` remain mutable stored
summaries and are not changed by the active allocation endpoint.

Target Phase 3 semantics:

```text
invoice open = posted invoice total
             - posted allocations
             - posted credit allocations

customer AR = sum(invoice open) - valid unapplied customer credits
```

Opening balances must become explicit posted opening receivables or be excluded
from production AR; a mutable customer master field cannot be an accounting
fact.

## 7. GL Integration

| Flow | Actual entries | Core writer | Atomic with document/subledger |
| --- | --- | --- | --- |
| Posted invoice | Dr AR; Cr revenue/tax; optional Dr COGS/Cr inventory | Yes, via `postInTransaction()` | Yes |
| Applied customer payment | Dr deposit/bank; Cr AR | Yes, via `post()` | **No** |
| Created sales receipt | Dr deposit/bank; Cr sales revenue | Yes, via `post()` | **No** |

All three reach the canonical Posting Engine, so AccountResolver, fiscal period,
functional-currency guardrails, idempotency, and exact ledger validation apply.
Payment and receipt orchestration nevertheless bypass the Phase 2 caller-owned
transaction capability. They also perform prechecks with regex/`Number()` in
feature code; the GL later revalidates exact money, but operational validation
is not yet canonical.

## 8. Relational Schema — Keep / Extend / Replace

### KEEP

- `customers`: correct company-owned relational master; keep account mapping.
- `invoices`: correct aggregate header and lifecycle nucleus.
- `invoice_lines`: correct relational detail foundation.
- Accounting Core tables and posting APIs: stable and unchanged.

### EXTEND

- `customer_payments`: activate it and add only lifecycle/reversal/posting
  metadata proven necessary by the workflow (migration likely required).
- `customer_payment_allocations`: use it as the authoritative allocation fact;
  add constraints/indexes or reversal metadata only where PostgreSQL exit tests
  prove necessary (migration likely required).
- Invoice settlement fields: either maintain `amount_paid` / `balance_due`
  atomically as guarded summaries or derive them from posted allocations. Do not
  continue both without an explicit invariant.

### REPLACE / MIGRATE

- Active `sales/payments` JSON CRUD and allocation arrays must cut over to the
  existing relational tables.
- Sales receipts need a small relational receipt/header and line model before
  they can be production accounting documents. Existing JSON receipt facts
  require expand-and-contract migration if retained.
- AR/sales financial report reads must stop using generic payment JSON and
  draft-inclusive invoice collections.

### DEFER

- Estimates, sales orders, recurring invoices, statements, refunds, and broader
  credit-note design unless directly required for AR stabilization.
- Inventory valuation redesign; retain the current minimal invoice interaction.
- FX conversion, Projects, Payroll, AP, and frontend redesign.

## 9. AR/Sales `resource_records` Dependencies

Active dependencies are:

- customer payments and their allocation arrays;
- sales receipts/cash sales;
- generic CRUD, audit, soft-delete/restore, reference-name enrichment, customer
  activity, and sales/payment reports for those resources.

Customers and invoices already have relational equivalents. Customers still
maintain a shadow `resource_records` row through
`PostgresResourceRepository.shadow()` / `mergeShadow()`, so customer storage is
relational but dual-represented for generic compatibility. Invoices are directly
delegated to their repository and are not generic writes.

Payment relational rows may already contain staged legacy data from migration
0007, while current writes continue to JSON. A Phase 3B cutover therefore needs
explicit reconciliation/migration checks; blindly replaying JSON can duplicate
or conflict with staged rows.

## 10. Atomicity & Reversal Gaps

### Invoice

Posting already composes invoice status, inventory effects, GL, and audit in one
transaction. Voiding reverses GL and inventory and marks the invoice voided in
one transaction. Posted edits/deletes are rejected; draft deletion is soft.

Concrete gap: a paid/allocated invoice can currently be voided without a
relational allocation check because active allocations live in JSON. That can
leave payment facts pointing at a voided invoice.

### Payment

The generic record is updated to `applied` before `ledger.post()` begins its own
transaction. A GL failure leaves an applied payment without GL; a later retry
can combine changed JSON allocations with the prior idempotent journal. No
payment reversal workflow exists. Generic update/delete protection checks only
selected statuses; an `applied` payment is mutable and soft-deletable without
reversing its AR/GL effect.

### Sales receipt

The generic record commits before GL posting. There is no explicit lifecycle,
atomic line persistence, or feature reversal. Statuses other than exactly
`posted` can be edited/deleted even after a journal exists.

## 11. Minimum Target AR Model

Use the four existing relational tables as the minimum AR model:

```text
customers
  -> invoices -> invoice_lines
  -> customer_payments -> customer_payment_allocations -> invoices
```

Required invariants:

- drafts create no GL or subledger effect;
- posting a payment validates and locks company/customer/payment/invoices;
- allocation sums cannot exceed payment amount or posted invoice open amount;
- a payment may allocate to many invoices and an invoice may receive many
  payments;
- `unapplied_amount` is exact and equals posted payment minus posted allocations;
- posted payment/allocation facts are immutable; corrections use reversal;
- posting uses Accounting Core `postInTransaction()` inside the caller's DB
  transaction.

No generic subledger or event-sourcing framework is needed. Sales receipts need
a separate small relational aggregate because a cash sale has document lines
and GL but deliberately creates no receivable.

## 12. Reconciliation Gap

Phase 3 must establish:

```text
sum(posted invoice totals
    - posted allocations
    - posted credit allocations)
= AR control account book-effective balance
```

Current blockers are JSON payment/allocation facts, non-atomic payment posting,
stale invoice settlement columns, draft-inclusive reports, omitted/mutable
customer opening balances, and the absence of payment reversal. The existing
Accounting Core can supply the GL side; the missing work is a reliable posted
AR subledger side.

## 13. Recommended Phase 3B–3G Sequence

### 3B — Activate Relational Payment Foundation

- Objective: repository/service lifecycle for relational payments and
  allocations; validate tenant, customer, invoice, amount, and draft rules.
- Likely files/tables: `customer_payments`,
  `customer_payment_allocations`, new payment repository/service/routes, Sales
  contracts, focused tests, and migration-0007 reconciliation.
- Migration: **Yes**, only for lifecycle/constraints proven missing.
- Acceptance: active writes/reads no longer use payment JSON; drafts have zero
  effect; valid partial/many-to-many/unapplied cases are representable.
- Dependency: Phase 2 Accounting Core transaction interface.

### 3C — Atomic Customer Payment Posting

- Objective: payment + allocations + invoice settlement projection + AR GL +
  audit commit together.
- Likely files/tables: payment application service/repository, payment posting
  adapter, invoices/allocations, Sales routes/tests.
- Migration: **No**, unless 3B proves a missing posting/reversal identity field.
- Acceptance: Dr bank/Cr AR is exact and idempotent; any failure rolls back every
  AR/payment/GL effect; allocation limits and locking are enforced.
- Dependency: 3B.

### 3D — Canonical AR Read Models and Cutover

- Objective: invoice/customer open balances and payment registers come only
  from posted relational facts.
- Likely files/tables: `record-read-model.ts`, AR report queries, invoice/payment
  repositories; remove active Sales payment JSON reads.
- Migration: **No** (data reconciliation may be required).
- Acceptance: drafts never affect balances; partial, multi-payment,
  multi-invoice, and unapplied credit totals are exact and reproducible.
- Dependency: 3C.

### 3E — Payment and Invoice Corrections

- Objective: immutable posted payment reversal and allocation reversal; prevent
  invoice void while active allocations remain unless coordinated safely.
- Likely files/tables: payment lifecycle/repository, invoice void coordinator,
  allocation facts, reversal adapter/tests.
- Migration: **Possibly**, if reversal links/status metadata are absent.
- Acceptance: no posted payment is edited/deleted; reversal restores AR and
  invoice/customer open balances atomically and remains auditable/idempotent.
- Dependency: 3C–3D.

### 3F — Relational Sales Receipts

- Objective: replace create-time JSON cash-sale posting with a relational draft
  and explicit atomic post/reverse lifecycle.
- Likely files/tables: new `sales_receipts` and receipt-line tables,
  repository/service/posting adapter/routes/tests; migrate retained JSON rows.
- Migration: **Yes**.
- Acceptance: drafts have zero effect; post atomically persists document +
  Dr cash/bank + Cr revenue; reversal is immutable; no AR is created.
- Dependency: 3B lifecycle patterns and Phase 2 core.

### 3G — AR Reconciliation and PostgreSQL Exit Gate

- Objective: prove AR subledger equals the AR control account and close legacy
  payment/receipt generic writes.
- Likely files/tables: reconciliation query/service, PostgreSQL integration and
  concurrency tests, migration exceptions/cutover controls.
- Migration: **Only if** exit tests expose missing DB constraints.
- Acceptance: reconciliation is zero for valid books; concurrent allocation,
  post, retry, void, and reversal cannot overapply or duplicate facts; all
  active AR/Sales financial reads use relational posted facts.
- Dependency: 3B–3F.

## 14. Phase 3 Exit Criteria

Phase 3 is complete only when:

1. invoices, payments, allocations, and sales receipts have one relational
   source each;
2. every draft has zero AR, cash, revenue, inventory-value, GL, and financial
   report effect;
3. invoice/payment/receipt posting and their required domain/audit effects are
   atomic through `postInTransaction()`;
4. partial payments, multiple payments per invoice, one payment across invoices,
   and unapplied credits are exact and constrained;
5. posted AR/Sales documents are immutable and correct through linked reversal;
6. customer and invoice open balances derive from posted relational facts;
7. AR reports exclude drafts and agree with the same subledger facts;
8. the AR subledger reconciles exactly to the AR control account;
9. active AR/Sales payment and receipt paths no longer depend on
   `resource_records`; and
10. targeted unit, API, PostgreSQL, idempotency, concurrency, and tenant-isolation
    tests pass.
