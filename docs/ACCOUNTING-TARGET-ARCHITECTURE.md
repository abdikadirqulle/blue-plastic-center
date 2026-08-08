# BLUE PLASTIC CENTER — Target Accounting Architecture

**Status:** Architecture contract  
**Phase:** Design only  
**Date:** 2026-08-08  
**Applies to:** BLUE PLASTIC CENTER modular-monolith backend and its financial read models

## 1. Executive architecture decision

BLUE PLASTIC CENTER will use a modular-monolith architecture with:

- dedicated relational aggregates for every financial document and subledger;
- one shared, transaction-scoped double-entry posting engine;
- module-owned posting adapters that translate business events into accounting
  meanings;
- append-only posted accounting and subledger facts;
- exact decimal-string API contracts and fixed-point internal arithmetic;
- read models derived only from posted normalized facts; and
- an expand-and-contract migration away from financial JSONB records.

The existing relational GL and `PostgresLedgerRepository.writePosting` are the
foundation to preserve. The target is stabilization, not a replacement ledger.
`writePosting` remains the only production component permitted to persist
`accounting_transactions` and `accounting_lines`. Its public boundary is the
transaction-aware posting service (`post` / `postInTransaction`), never direct
access from feature modules to `writePosting`.

> **Decision →** Use a shared accounting engine behind module-specific posting
> adapters.  
> **Why →** Accounting validation is universal, while sales, AP, inventory,
> payroll, and banking facts have different ownership and lifecycle rules.  
> **Consequence →** Modules request accounting meanings and coordinate their own
> subledger effects; they never insert or update journal lines.

> **Decision →** A posted document and all its required subledger, inventory,
> GL, and audit effects commit in one PostgreSQL transaction.  
> **Why →** A financially valid system cannot tolerate a posted document without
> its ledger entry, or a ledger entry without its source/subledger effect.  
> **Consequence →** All repositories used by a posting workflow must accept the
> caller's Drizzle transaction.

> **Decision →** `resource_records` remains a transitional source only for
> unmigrated resources.  
> **Why →** Removing it now would lose live data and break unfinished modules.  
> **Consequence →** Each financial slice gets an explicit cutover and one
> canonical source before its old JSON writes are disabled.

This document is authoritative for future accounting work. If implementation
and this contract differ, the implementation must either be corrected or this
decision must be amended through an explicit architecture review.

## 2. Target architecture diagram

```text
React/Vite UI
    |
    | typed REST DTOs (decimal strings, IDs, versions)
    v
Fastify route + authorization + company/branch context
    |
    v
Application command service / lifecycle coordinator
    |-- loads and locks business document aggregate
    |-- validates transition and approval policy
    |-- calls module-owned subledger services
    |-- calls module-owned posting adapter
    |
    +---------------- PostgreSQL transaction -----------------+
    |                                                         |
    |  Document repository       AR/AP/Inventory/Bank service |
    |        |                         |                      |
    |        v                         v                      |
    |  normalized document       append-only subledger facts |
    |                                                         |
    |  Domain Posting Adapter                                  |
    |        | accounting meanings + exact amounts             |
    |        v                                                 |
    |  Account Resolution Service                              |
    |        | resolved account IDs                            |
    |        v                                                 |
    |  Shared Accounting Posting Engine                        |
    |        |                                                 |
    |        v                                                 |
    |  PostgresLedgerRepository.writePosting                   |
    |        |                                                 |
    |        v                                                 |
    |  accounting_transactions + accounting_lines             |
    |                                                         |
    |  audit_events + outbox_events                            |
    +---------------------------------------------------------+
                              |
                              v
             Posted normalized facts / ledger watermark
                              |
                              v
             Read-model queries, reconciliation, reports
                              |
                              v
                         API and UI
```

Asynchronous work such as email, PDF generation, exports, notifications, and
integrations begins from an outbox event written in the posting transaction.
It is not part of the financial commit and may retry independently.

## 3. Accounting Core

### 3.1 Responsibilities inside the accounting engine

The accounting engine owns only universal ledger concerns:

1. validating the authenticated company and permitted branch context;
2. validating posting date, fiscal period, currency, exchange rate, and source;
3. resolving approved account meanings or account references to active accounts;
4. enforcing system/control-account and manual-posting restrictions;
5. validating at least two journal lines, exactly one positive side per line,
   non-negative amounts, and equal non-zero debits and credits;
6. calculating or validating functional-currency line amounts and FX rounding;
7. reserving and completing idempotency keys;
8. rejecting duplicate source postings;
9. assigning journal numbers and persisting journal headers and lines;
10. linking reversals to their original transaction;
11. writing the immutable posting audit event; and
12. returning the canonical posting identity.

The engine must not own:

- invoice, bill, payment, payroll, asset, or bank-document lifecycle rules;
- customer/vendor payment allocation;
- inventory quantity, costing, reservation, or warehouse policy;
- tax determination, pricing, discounts, commissions, or credit limits;
- purchase matching, project costing, payroll calculation, or depreciation
  scheduling;
- UI DTO construction or report presentation; or
- email, PDF, attachment, import, or notification delivery.

Those concerns stay in their domain modules. A domain posting adapter supplies
the accounting interpretation after its module has validated the business fact.

### 3.2 Chart of Accounts

`accounts` is the canonical Chart of Accounts. Each account is company-owned
and has a stable ID, unique company account number, name, type, subtype, normal
balance, currency policy, active flag, and posting restrictions.

Target account types and normal balances:

| Account type | Normal balance | Typical examples |
| --- | --- | --- |
| Asset | Debit | Cash, bank, AR, inventory, fixed assets |
| Contra asset | Credit | Accumulated depreciation, allowance |
| Liability | Credit | AP, tax payable, accrued liabilities |
| Contra liability | Debit | Discounts or debt issuance costs where used |
| Equity | Credit | Capital, retained earnings |
| Contra equity | Debit | Drawings, treasury-style balances |
| Income | Credit | Product sales, service revenue |
| Contra income | Debit | Sales returns and discounts |
| Cost of goods sold | Debit | Product and manufacturing cost |
| Expense | Debit | Payroll, rent, utilities, depreciation |
| Other income / expense | As classified | FX gains/losses, exceptional items |

Account type and normal balance are explicit, not inferred repeatedly from
account numbers. Account hierarchies use a company-safe self-reference; a child
cannot belong to another company. Accounts referenced by posted facts cannot be
hard deleted or renumbered without a controlled migration.

### 3.3 System and control accounts

System accounts have stable semantic keys such as:

```text
accounts_receivable     accounts_payable
inventory_asset        cost_of_goods_sold
sales_revenue          service_revenue
sales_discounts        sales_tax_payable
cash                   bank                 mobile_money
owner_capital          retained_earnings
opening_balance_equity fx_gain              fx_loss
bank_fees              payroll_payable      depreciation_expense
accumulated_depreciation
```

Control accounts (`accounts_receivable`, `accounts_payable`, and
`inventory_asset`) reject manual journal posting by default. Only secured domain
posting adapters may post them. Accountant-approved adjusting workflows require
a distinct privileged adjustment profile, reason, and audit record.

### 3.4 Posting profiles and mappings

Account numbers are presentation identifiers, never application constants.
The target model uses:

- company system-account mappings for universal meanings;
- posting profiles for event-specific debit/credit roles;
- item or item-category mappings for revenue, COGS, and inventory;
- tax-code mappings for tax payable/receivable;
- bank/payment-instrument mappings for cash, bank, and mobile money;
- payroll component mappings;
- fixed-asset category mappings; and
- project/customer/vendor overrides only where the business requires them.

Missing, inactive, cross-company, or type-incompatible mappings fail posting.
The engine never silently falls back to a numbered account.

### 3.5 Journal transactions and lines

`accounting_transactions` is the immutable journal header and
`accounting_lines` is the immutable line set. A posted header records company,
branch, transaction number/date, source tuple, posting kind, fiscal period,
transaction currency, functional currency, exchange rate, actor, timestamp,
idempotency fingerprint, and reversal link.

Every line records account, description, transaction-currency debit/credit and
functional-currency debit/credit. The target should retain both currency views;
storing an exchange rate alone is insufficient for reproducible historical
reports after rate policies change.

The current status convention may continue: a reversed original is marked
`reversed` for workflow visibility, but its lines remain book-effective beside
the posted opposite reversal. Ledger queries include both facts so the pair
nets to zero.

### 3.6 Fiscal periods

Every posting date must resolve to exactly one company fiscal period. Target
states are `open`, `soft_closed`, and `closed`:

- `open`: authorized posting is allowed;
- `soft_closed`: only explicitly privileged adjusting postings are allowed;
- `closed`: no posting is allowed until a separately authorized reopening.

No matching fiscal period is an error, not permission to post with a null
period. Period reopening records actor, reason, time, and prior state.

### 3.7 Currencies and exchange rates

Each company has one functional currency. Documents carry transaction currency.
Posting records the selected rate and rate source/date. The adapter supplies
transaction-currency amounts; the accounting engine produces/validates
functional-currency amounts using the canonical money service. A journal must
balance in functional currency. Any permitted rounding residual posts to a
configured FX rounding account and is visible, never silently discarded.

### 3.8 Reversals, idempotency, and audit

A reversal is a new posted transaction with lines exactly opposite the original,
the same source identity and currency context, a new posting date, and a required
`reversal_of_id`. Reversals are tenant-resolved and cannot cross company scope.

Idempotency is scoped by company and command key. Reusing a key with the same
canonical request returns the original result; reusing it with different content
fails. A second key for the same `(company, source module, source type, source
ID, posting kind)` also fails. Document and subledger idempotency use equivalent
unique source constraints.

Audit events are append-only. Posting audit includes request, actor, company,
branch, source document, transition, posting result, approval context, and
reversal reason. Audit records describe an action; they do not replace business
or accounting facts.

## 4. Financial document lifecycle

All financial documents use one canonical lifecycle:

```text
DRAFT -> APPROVED (optional by policy) -> POSTED -> REVERSED or VOIDED
```

| State | Meaning | Permitted financial effects |
| --- | --- | --- |
| `DRAFT` | Editable proposal; incomplete or awaiting user action | None: no GL, AR, AP, inventory movement/value, cash/bank effect, or financial report effect |
| `APPROVED` | Business authorization completed, but not yet posted | None; may reserve operational capacity only if reservation is clearly non-financial |
| `POSTED` | Final financial fact; required subledgers and GL committed | Included in GL, subledgers, inventory valuation/quantity where relevant, cash/bank balances, and reports |
| `REVERSED` | A posted fact has been cancelled by an explicit opposite fact | Original and reversal remain visible and net to zero from reversal date |
| `VOIDED` | Document is cancelled; if it was posted, void is implemented by reversal | An unposted void has no financial effect; a posted void retains original plus reversal |

`OPEN`, `PARTIALLY_PAID`, `PAID`, and `OVERDUE` are settlement/read-model states
of a posted invoice or bill, not substitutes for the accounting lifecycle.
Likewise `RECEIVED`, `SHIPPED`, and `RECONCILED` are operational dimensions.
They should be modeled separately or derived so one status column does not mix
authorization, posting, fulfillment, and settlement semantics.

### Lifecycle rules

1. Creating, importing, copying, or editing a draft never invokes posting.
2. Approval never creates financial effects unless the explicit action is
   “approve and post,” which still performs a separate validated transition.
3. Posting requires optimistic version validation and an idempotency key.
4. Posted documents are immutable. Notes that are legally non-financial may be
   amended only through a separately audited metadata mechanism.
5. A correction to amount, account, party, warehouse, date, currency, or tax
   reverses/voids the original and creates a corrected document or adjustment.
6. A paid invoice or bill cannot be voided without first reversing/unapplying
   the related settlements in the same controlled workflow.
7. Soft deletion is allowed only for drafts. Posted/reversed facts are never
   deleted or hidden from books and audit reports.

> **Decision →** Separate accounting lifecycle from settlement and fulfillment
> status.  
> **Why →** A single overloaded status creates ambiguous behavior such as
> “applied” payments or “open” invoices being treated inconsistently.  
> **Consequence →** Posting state is authoritative; settlement and operational
> states are derived or stored in dedicated constrained fields.

## 5. Posting contract

### 5.1 Target command

The shared command should evolve from the current `PostingCommand` without
becoming a business-document DTO:

```ts
interface PostingCommand {
  context: {
    companyId: UUID       // injected from authenticated context
    branchId: UUID        // injected/authorized, not trusted from body
    actorId: UUID
    requestId: string
  }
  source: {
    module: PostingModule
    type: PostingSourceType
    id: UUID
    version: number
    postingKind: "primary" | "adjustment" | "reversal"
    reversalOfId?: UUID
  }
  idempotencyKey: string
  transactionDate: LocalDate
  currency: {
    transactionCurrency: CurrencyCode
    functionalCurrency: CurrencyCode
    exchangeRate: DecimalString8
    rateDate: LocalDate
    rateSource: string
  }
  memo?: string
  lines: Array<{
    accountMeaning?: AccountMeaning
    accountId?: UUID
    mappingContext?: MappingContext
    description?: string
    debit: MoneyString4
    credit: MoneyString4
    dimensions?: { projectId?: UUID; departmentId?: UUID; classId?: UUID }
  }>
}
```

Exactly one account request is present per line. Domain adapters normally use
`accountMeaning` plus mapping context. Direct account IDs are permitted for
validated manual journals and explicit expense/revenue lines, subject to type
and control-account rules. Account numbers are excluded from automated domain
commands.

### 5.2 Target result

```ts
interface PostingResult {
  transactionId: UUID
  transactionNumber: string
  status: "posted"
  source: { module: string; type: string; id: UUID; postingKind: string }
  fiscalPeriodId: UUID
  transactionCurrency: CurrencyCode
  functionalCurrency: CurrencyCode
  transactionDebit: MoneyString4
  transactionCredit: MoneyString4
  functionalDebit: MoneyString4
  functionalCredit: MoneyString4
  postingFingerprint: string
  postedAt: ISODateTime
}
```

### 5.3 Posting path

```text
Business document
  -> lifecycle command service
  -> domain posting adapter
  -> account-resolution service
  -> createBalancedJournalEntry / validation
  -> ledger.postInTransaction
  -> PostgresLedgerRepository.writePosting
  -> GL + audit result
```

`writePosting` remains private and canonical. Higher-level services call
`postInTransaction` with the same transaction used for document and subledger
updates. The standalone `post` wrapper is reserved for actions whose only
durable financial change is the GL posting.

### 5.4 Reversal contract

The reversal command identifies the original source tuple, original transaction
ID, reversal date, reason, actor, and idempotency key. The engine loads the
original transaction in the same company, mirrors its stored lines and currency
amounts, writes the new reversal, and marks the original reversed in one
transaction. Feature modules then reverse their own subledger facts in that same
transaction; they never reconstruct historical costs or exchange rates from
current master data.

## 6. Transaction and atomicity boundary

The application command service opens one PostgreSQL transaction for every
financial transition. For a stocked credit invoice, the following are one unit:

1. lock and re-read invoice/version/status;
2. validate customer, items, warehouse, currency, period, and mappings;
3. reserve document-post idempotency;
4. calculate final exact totals;
5. append AR invoice/subledger effect;
6. lock inventory balances in deterministic `(warehouse_id, item_id)` order;
7. calculate and append inventory issue movements/cost layers;
8. update inventory balance projections;
9. construct revenue/tax/discount/AR and COGS/inventory posting lines;
10. execute `ledger.postInTransaction`;
11. mark the invoice posted and record posting transaction ID;
12. append audit and outbox events; and
13. commit.

Any failure rolls back every item. The same rule applies to payment allocation,
bill posting, vendor payment, bank transfer, payroll run, depreciation run, and
reversal.

Operations outside the financial transaction:

- email, PDF, webhook, and notification delivery;
- search indexing and analytics refresh;
- cache invalidation; and
- large exports.

They consume an outbox event and may retry. Their failure never rolls back or
duplicates a committed financial fact.

> **Decision →** Use application-level transaction coordinators, not distributed
> sagas, for the current modular monolith.  
> **Why →** All authoritative financial tables share one PostgreSQL database.  
> **Consequence →** Atomicity is simpler and stronger; an outbox handles only
> post-commit external effects.

## 7. Accounts Receivable architecture

AR owns:

- posted invoices and invoice lines;
- customer credit notes and applications;
- customer payments;
- payment allocations;
- settlement state and as-of open amounts; and
- customer statements and aging read models.

It does not own the GL journal. It asks the accounting engine to post AR control,
revenue, tax, discount, cash/bank, and write-off effects.

Canonical behavior:

- A draft invoice has no AR effect.
- Posting an invoice appends an AR charge equal to its functional-currency total
  and posts DR AR / CR revenue-tax-discount effects.
- Receiving a payment creates a posted payment. Allocation rows relate that
  payment to posted invoices/credits. Unapplied cash remains a customer credit
  in the AR subledger; it is never lost.
- Allocation totals cannot exceed payment amount, invoice open amount, or credit
  open amount as of the transaction.
- Partial/full settlement is derived from posted allocations and reversals.
- Reversing a payment or invoice appends opposite subledger facts and GL entries;
  it does not edit prior allocations silently.

Canonical calculations as of a date:

```text
Invoice open amount
  = posted invoice amount
  - posted payment allocations
  - posted credit allocations
  + reversed allocations

Customer open balance
  = open invoices
  - unapplied customer credits
  - unapplied customer payments (according to presentation policy)

AR aging
  = invoice/credit open amounts bucketed by contractual due date as of report date
```

Required reconciliation for each company, branch scope, currency basis, and date:

```text
AR subledger functional balance = Accounts Receivable control-account balance
```

Opening customer balances are imported as explicit posted opening documents and
GL effects, not mutable customer-master balances.

## 8. Accounts Payable architecture

AP mirrors AR with vendor-owned documents:

- bills and bill lines;
- vendor credits;
- vendor payments;
- payment allocations;
- purchase/receipt matching references;
- settlement state, statements, and aging.

A draft/approved bill has no AP or GL effect. Posting an expense bill creates
DR expense (or asset/prepayment) / CR AP. Posting an inventory bill coordinates
receipt/landed-cost policy with inventory and posts inventory/receipt accrual/AP
as configured. Vendor payment posts DR AP / CR bank and writes allocations in
the same transaction.

```text
Bill open amount
  = posted bill amount
  - posted vendor-payment allocations
  - posted vendor-credit allocations
  + reversed allocations

AP subledger functional balance = Accounts Payable control-account balance
```

Drafts never appear in vendor open balance or AP aging. Purchase orders are
commitments, not AP. Goods receipts affect inventory/receipt accrual according
to policy but do not become AP until a bill or approved self-billing event.

## 9. Inventory architecture

Inventory is an append-only subledger with a locked balance projection. It owns:

- item and warehouse masters;
- reservations (non-financial);
- receipts, issues, returns, transfers, and adjustments;
- cost layers or weighted-average state;
- landed-cost allocations;
- quantity-on-hand and valuation projections; and
- source-to-movement traceability.

Default costing for BLUE PLASTIC CENTER is perpetual weighted average at scale
4, matching the existing strongest implementation. A later FIFO option must be
a separate policy implementation, not conditional arithmetic scattered across
modules.

Every posted stock event appends one or more `inventory_movements` with source
document and line IDs, quantity/value deltas, unit cost, after-balances, actor,
and reversal linkage. `inventory_balances` is a concurrency-controlled
projection, not independent truth; movements can rebuild it.

Stocked-item invoice posting:

```text
Sales/AR:       DR AR or Cash / CR Revenue (+ tax/discount)
Inventory:      quantity issue at historical WAC
Cost/valuation: DR COGS / CR Inventory Asset
```

A warehouse transfer creates equal opposite quantity/value movements and no
income/expense. An adjustment requires reason and approved gain/loss mapping.
A return reverses the source movement using source cost when traceable, not the
current price. Negative stock is rejected by default.

Required reconciliation:

```text
Sum of inventory movement value through date
  = inventory balance projection
  = Inventory Asset control-account balance
```

## 10. Banking and cash architecture

Banking owns financial-institution and reconciliation facts, not arbitrary
mutable balances:

- bank/cash/mobile-money account masters mapped to GL accounts;
- deposits, withdrawals, cheques, fees, and transfers;
- imported statement batches and immutable statement lines;
- matching links between statement lines and posted system transactions; and
- reconciliation sessions with opening/closing statement balances.

Bank, cash, and mobile-money balances derive from posted GL lines for their
mapped accounts. A stored bank-account `balance` is forbidden as a source of
truth. Statement balances are external evidence used for reconciliation.

A transfer posts DR destination cash account / CR source cash account. It does
not create revenue or expense except an explicit bank-fee line. Cross-currency
transfers use an approved FX workflow and realized gain/loss mapping. Reconciled
transactions remain reversible only through a controlled process that reopens
or invalidates the affected reconciliation.

## 11. Module responsibilities

| Module | Owns | Calls |
| --- | --- | --- |
| Sales | customers, estimates/orders, invoices, receipts, credits, pricing, sales lifecycle | AR, inventory for stocked lines, tax, account resolution, posting engine |
| Purchasing | vendors, requisitions/POs, receipts, bills, credits, matching | AP, inventory/landed cost, tax, account resolution, posting engine |
| Inventory | items, warehouses, movements, balances, costing, transfers, adjustments | account resolution and posting engine for valuation effects |
| Banking | bank/payment accounts, transfers, statement lines, matching, reconciliation | account resolution and posting engine |
| General Ledger | accounts, mappings, periods, journals, reversals, posting validation | no feature-module persistence; exposes posting/reversal/reconciliation services |
| Projects | projects, tasks, billing links, cost/revenue dimensions | sales/purchasing/payroll adapters; never duplicates GL amounts |
| Payroll | employees, pay runs, earnings, deductions, liabilities, payments | projects/dimensions, banking, account resolution, posting engine |
| Fixed Assets | asset register, capitalization, depreciation schedules, disposals | purchasing source links, account resolution, posting engine |

### Avoiding giant posting functions

A posted sale is coordinated by small composable services:

```text
PostInvoiceCommandHandler
  -> InvoicePolicy             validates lifecycle and credit policy
  -> InvoiceCalculator         exact prices/discount/tax totals
  -> ArPostingService          creates AR subledger effects
  -> InventoryIssueService     applies quantity and WAC cost
  -> SalesPostingAdapter       produces accounting meanings/amounts
  -> AccountResolver           resolves meanings to company accounts
  -> AccountingPostingEngine  validates and writes GL
  -> Audit/OutboxWriter        records action and post-commit work
```

The command handler coordinates; it does not implement each calculation. Each
service accepts the same transaction and returns typed facts consumed by the
next component. Posting adapters are pure where possible and have contract tests.

## 12. Account mapping strategy

The default resolution precedence is:

1. **Legally explicit transaction mapping** — an authorized direct account on
   an expense/revenue/manual line, after company/type/control validation.
2. **Item or category mapping** — revenue, inventory asset, COGS, purchase
   expense, and return accounts.
3. **Tax-code mapping** — sales/purchase tax control account.
4. **Payment instrument/bank mapping** — cash, bank, mobile-money, fee account.
5. **Event posting profile** — e.g. domestic credit sale, inventory receipt,
   payroll accrual, depreciation.
6. **Company system-account mapping** — final semantic default.

There is no account-number fallback. Each resolution validates company, active
state, permitted account type, currency policy, and whether the caller may use
a control account. The resolved account ID and mapping version are recorded with
the posting facts for reproducibility.

Suggested conceptual tables:

```text
account_meanings
company_account_mappings
posting_profiles
posting_profile_lines
item_account_mappings (or fields on item/category)
tax_account_mappings
payment_account_mappings
```

## 13. Money policy

### 13.1 Representations

| Layer | Representation |
| --- | --- |
| REST/JSON and shared contracts | validated decimal strings; never JSON numbers for money/rates/quantity |
| PostgreSQL money and ledger columns | `numeric(20,4)` unless a narrower domain rule is documented |
| PostgreSQL exchange rate | `numeric(20,8)` |
| PostgreSQL percentage/tax rate | `numeric(9,6)` |
| Internal TypeScript calculations | signed `bigint` fixed-point values with explicit scale |
| UI | decimal strings for editing; formatting only at display boundary |

Canonical scales:

- posted money and functional money: 4 decimal places;
- unit price and unit cost: 4 decimal places;
- inventory quantity: 4 decimal places for current compatibility;
- exchange rate: 8 decimal places;
- percentage/tax rate: 6 decimal places;
- currency display: `currencies.decimal_places`, normally 2, without changing
  stored accounting precision.

Values with excess precision are rejected unless an explicit conversion utility
rounds them. They are never truncated with `slice`, `Number`, `parseFloat`, or
`toFixed` in domain logic.

### 13.2 Rounding

Default rounding is round-half-away-from-zero. The system rounds only at defined
boundaries:

1. quantity × unit price to line money scale;
2. line discount and tax to line money scale;
3. document total as the exact sum of rounded lines;
4. transaction-to-functional conversion per journal line; and
5. a visible FX rounding line if the converted journal has an allowed residual.

Recalculating a stored posted document uses the stored line amounts, rates, and
rounding result—not current settings.

The canonical utilities should be a shared package with branded types and pure
functions: `parseDecimal`, `formatDecimal`, `add`, `subtract`, `multiply`,
`divide`, `round`, `compare`, `sum`, `convertCurrency`, and `allocateRemainder`.
Current `ledger-math.ts`, invoice fixed-point calculation, balance math, and
inventory costing should converge onto it; `operations/money.ts` truncation and
report `Number()` aggregations must be retired.

## 14. Canonical relational model

All financial header tables carry company ownership; operationally relevant
headers carry branch. Mutable drafts carry `version`, `created_by`, `updated_by`,
timestamps, and soft-delete fields. Posted fact rows are append-only.

### 14.1 Accounting and setup

| Table | Ownership / relationships | Status / money | Source of truth |
| --- | --- | --- | --- |
| `accounts` | company; self-parent constrained to company | active; normal balance | Chart of Accounts |
| `company_account_mappings` | company + semantic key -> account | active/versioned | system account resolution |
| `posting_profiles` / lines | company; event type; account meanings | active/versioned | event mapping defaults |
| `fiscal_periods` | company/fiscal year | open/soft-closed/closed | period authorization |
| `currencies` | company/code | display precision, active | permitted currencies |
| `exchange_rates` | company, from/to/date/source | numeric(20,8), approved | historical rate selection |
| `accounting_transactions` | company, branch, source, period, reversal | posted/reversed; dual currency | immutable GL headers |
| `accounting_lines` | transaction, account, dimensions | money scale 4 in transaction/functional currency | immutable GL facts |
| `posting_idempotency_keys` | company, source, transaction | processing/completed/failed | posting retry result |

### 14.2 AR

| Table | Key relationships | Source-of-truth responsibility |
| --- | --- | --- |
| `customers` | company, terms, AR mapping | customer master only |
| `invoices` / `invoice_lines` | customer, branch, item/account/tax/warehouse | invoice document and stored posted totals |
| `customer_credit_notes` / lines | customer, source invoice optional | credit document |
| `customer_payments` | customer, deposit account | receipt document and unapplied amount |
| `customer_payment_allocations` | payment to invoice/credit | settlement facts |
| `ar_entries` | source document/payment/allocation | append-only AR charge/credit subledger |

`invoices.amount_paid` and `balance_due` may remain transactionally maintained
projections for fast UI reads, but allocation/AR facts are canonical and must
rebuild/reconcile those projections.

### 14.3 AP

```text
vendors
bills / bill_lines
vendor_credit_notes / vendor_credit_lines
vendor_payments
vendor_payment_allocations
ap_entries
purchase_orders / purchase_order_lines
goods_receipts / goods_receipt_lines
three_way_match_results
```

Bills and payments own document facts; allocation/AP entries own settlement and
open-balance facts. POs do not create AP.

### 14.4 Inventory

```text
items / item_categories / units_of_measure
warehouses / bins
inventory_movements                 append-only canonical stock/value events
inventory_balances                  locked rebuildable projection
inventory_cost_layers               required for FIFO; optional for WAC audit detail
inventory_reservations              operational, non-financial
inventory_transfers / lines
inventory_adjustments / lines
stock_counts / lines
landed_cost_documents / allocations
lots / serial_numbers               when enabled
```

### 14.5 Banking, tax, projects, payroll, and assets

```text
bank_accounts                       maps instrument to GL account
bank_transactions                   business document, never balance source
bank_statement_batches / lines      immutable imported evidence
bank_matches                        statement-to-posted-fact links
bank_reconciliations / items        reconciliation evidence

tax_codes / tax_rates / tax_periods / tax_entries
projects / project_dimensions / project_billing_links
employees / pay_runs / pay_run_lines / payroll_liabilities / payroll_payments
fixed_assets / asset_categories / depreciation_runs / depreciation_entries
```

### 14.6 Audit and integration

`audit_events` remains immutable action history. `outbox_events` is added for
reliable post-commit jobs. Attachments reference typed entity identity rather
than assuming a `resource_records` ID. `migration_exceptions` remains the
quarantine ledger for expand-and-contract work.

### 14.7 Financial `resource_records` migration inventory

These resources must eventually move to dedicated tables before their modules
are production-ready:

- `accounting/journal-entries`, recurring journals, budgets, fixed assets;
- `sales/payments`, sales receipts, credit notes, refunds, deposits, statements;
- `purchasing/bills`, bill payments, expenses, vendor credits, POs, receipts;
- `inventory/transfers`, adjustments, counts, assemblies, landed cost;
- all banking deposits, transfers, cheques, statements, matches, reconciliation;
- `debts/receivables` and `debts/payables` (retire as financial sources);
- project financial documents, payroll runs/payments, and asset transactions.

Generic JSON may remain for non-financial configurable metadata after review,
but never for a posted financial fact or balance source.

## 15. Source-of-truth matrix

| Business fact | Canonical source | Derived/read model | Forbidden alternative sources |
| --- | --- | --- | --- |
| Customer invoice total | posted `invoices` + `invoice_lines` stored totals | invoice projection/PDF | browser-calculated total, JSON shadow |
| Invoice open amount | posted AR entries/allocations/credits | invoice settlement projection | mutable manual `balanceDue`, `debts/receivables` |
| Customer balance | AR subledger entries as of date | customer balance/statement | customer opening-balance field, page-list sums |
| Vendor bill total | posted `bills` + lines | bill projection | JSON bill total after cutover |
| Bill open amount | AP entries/allocations/credits | bill settlement projection | mutable outstanding field |
| Vendor balance | AP subledger entries as of date | vendor statement/aging | draft bills, vendor master balance |
| Account balance | posted/reversed accounting lines | account register/trial balance | account master balance, operational totals |
| Bank/cash balance | GL lines for mapped cash account | bank register/cash dashboard | mutable bank-account balance, statement ending balance |
| Inventory quantity | append-only inventory movements | inventory balance projection | item master quantity, form value |
| Inventory valuation | inventory movement values/cost layers | valuation by item/warehouse | purchase price × quantity, stock-level JSON |
| AR aging | posted invoice/credit/payment allocation facts | as-of aging buckets | `debts/receivables`, current invoice list only |
| AP aging | posted bill/credit/payment allocation facts | as-of aging buckets | `debts/payables`, draft bill lists |
| Tax liability | posted tax entries reconciled to tax control | tax return/workpaper | recomputation from current tax rates |
| Project profitability | GL/subledger lines carrying project dimension | project P&L/read model | project master totals |

Projections are allowed for performance only when their canonical inputs,
watermark, and deterministic rebuild procedure are defined. A projection mismatch
is a reconciliation failure, not permission to choose the more convenient value.

## 16. Read-model and reporting architecture

```text
Posted normalized documents and append-only subledgers
                    +
            posted/reversed GL facts
                    |
                    v
      tenant-scoped SQL read-model repositories
                    |
                    v
       typed report DTOs / bounded exports
                    |
                    v
                 UI/PDF/XLSX
```

Canonical report sources:

| Report/read model | Canonical query source |
| --- | --- |
| Trial Balance | accounting lines grouped by account through date/period |
| General Ledger | transaction and line detail with source and running balance |
| Profit & Loss | posted income, COGS, and expense lines for period |
| Balance Sheet | asset/liability/equity lines through date plus derived current earnings |
| AR Aging | posted AR documents, credits, payments, allocations as of date |
| AP Aging | posted AP documents, credits, payments, allocations as of date |
| Inventory Valuation | inventory movements/cost state through date |
| Customer/vendor balance | AR/AP subledger as-of query |
| Account register | posted/reversed GL detail for one account |
| Cash Flow | classified cash-account movements reconciled opening to closing cash |

Every query includes authenticated company, authorized branch set, date/as-of,
accounting basis, currency policy, and reversal policy. UUIDs are grouping keys,
not display labels; projections join human-readable names and document numbers.

Reports never repair, guess, or reinterpret transactional data. Unsupported
reports remain registered as unsupported and return `REPORT_NOT_IMPLEMENTED`.
There is no silent fallback to Trial Balance, Audit Trail, aging, or another
dataset.

## 17. Reconciliation framework

Reconciliation is a first-class service, test fixture, and accountant-facing
diagnostic. Each check returns company, branch scope, currency basis, as-of date,
left/right totals, difference, pass/fail, source watermark, and drill-down links.

Required checks:

1. every journal has non-zero equal debits and credits;
2. transaction-currency and functional-currency journal totals balance;
3. AR subledger equals AR control account;
4. AP subledger equals AP control account;
5. inventory valuation equals Inventory Asset control account;
6. bank subledger/register equals its mapped cash GL account;
7. payment allocations do not exceed payment or document open amounts;
8. posted invoices, bills, payments, stock movements, payroll runs, asset runs,
   and bank transfers have exactly the expected primary posting;
9. reversed source facts have exactly one valid reversal and opposite amounts;
10. document header totals equal exact line/tax/discount totals;
11. maintained balance projections rebuild from canonical facts; and
12. no posted financial source remains only in generic JSON.

Automated integration tests run these after each fixture workflow and migration.
Scheduled diagnostics run them per open period and before close. Period close is
blocked on unexplained differences. The UI shows differences and drill-down;
it never offers a “force match” that edits balances.

## 18. Target backend boundaries

The existing modular monolith remains. Recommended additions are deliberately
small and explicit:

```text
apps/api/src/
  accounting/
    domain/             money types, posting command, lifecycle invariants
    application/        posting service, reversal service, period service
    infrastructure/     PostgresLedgerRepository, account resolver
  ar/
    application/        invoice posting, payment receipt/allocation, credit application
    infrastructure/     invoice/payment/allocation repositories, AR read models
  ap/
    application/        bill posting, payment/allocation, vendor credit
    infrastructure/     AP repositories/read models
  inventory/
    domain/             WAC/FIFO policy, movement types
    application/        receipt, issue, transfer, adjustment, reversal
    infrastructure/     movement/balance/cost repositories
  banking/
    application/        deposit, transfer, fee, statement matching, reconciliation
    infrastructure/     bank/statement/reconciliation repositories
  posting-adapters/
    sales.ts purchasing.ts inventory.ts banking.ts payroll.ts fixed-assets.ts
  reconciliation/
    application/        reconciliation runner
    read-models/         control/subledger queries and diagnostics
  reports/
    registry.ts          explicit supported report mapping
    read-models/         ledger/subledger SQL queries
  platform/
    money/               canonical fixed-point package adapter
    transactions/        transaction runner abstraction
    outbox/              post-commit delivery
```

This is conceptual placement, not a requirement to rename every current folder.
Existing working modules may evolve in place. The required boundary is behavioral:
domain adapters do not persist GL, repositories do not invent accounting, and
reports do not become transaction services.

## 19. Current-to-target migration strategy

Use one vertical slice at a time. Never dual-write indefinitely and never delete
legacy rows during expansion.

### Stage 0 — Freeze invariants and establish gates

1. Introduce: this architecture contract, lifecycle vocabulary, money policy,
   reconciliation test harness, and production-shaped PostgreSQL fixtures.
2. Retain: all current behavior temporarily.
3. Migrate: none.
4. Verify: baseline counts, TB, AR/AP/inventory differences per company.
5. Disable old writes: none yet.
6. Remove: nothing.

### Stage 1 — Harden accounting core

1. Introduce: required-period validation, functional-currency line amounts,
   account-resolution service, posting profiles, outbox.
2. Retain: current `writePosting` persistence path and compatible commands.
3. Migrate: account semantic mappings and period coverage.
4. Verify: balanced/tenant/closed-period/idempotency/reversal concurrency tests.
5. Disable: automated account-number posting and direct GL inserts outside seed
   tooling.
6. Remove: obsolete duplicate money/posting helpers after all callers switch.

### Stage 2 — Complete AR vertical slice

1. Introduce: relational payments, allocations, credits, AR entries, unified
   invoice/payment lifecycle.
2. Retain: legacy JSON payment rows read-only during reconciliation.
3. Migrate: valid payments/allocations; quarantine invalid or overallocated rows.
4. Verify: draft/no-effect, partial/full/unapplied payment, void protection,
   AR=control, tenant isolation, retries, rollback.
5. Disable: `sales/payments`, sales receipts, and `debts/receivables` generic
   financial writes.
6. Remove: old rows only after backup approval and two successful closes.

### Stage 3 — Complete AP vertical slice

Follow the same sequence for bills, expenses, vendor credits, payments, and
allocations. Verify AP=control and exclude drafts before disabling JSON AP writes.

### Stage 4 — Complete inventory and purchasing coordination

1. Introduce: all movement types, receipt/bill linkage, landed cost, transfer and
   adjustment persistence.
2. Retain: existing invoice movement path and legacy operational documents.
3. Migrate: opening stock and traceable movements; quarantine unexplained stock.
4. Verify: quantity/value rebuild, WAC/FIFO fixtures, source idempotency,
   inventory=control, sales/returns/PO receipt.
5. Disable: generic inventory financial writes and stocked cash-sale shortcuts.
6. Remove: stock-level JSON financial sources after reconciliation.

### Stage 5 — Banking and cash

Wire deposits/transfers/fees through banking command services, migrate statement
and reconciliation evidence, and prove each mapped register equals GL. Disable
ad-hoc cash effects in sales/payment routes after shared banking adapters own them.

### Stage 6 — Payroll, projects, and fixed assets

Migrate pay runs, payroll liabilities/payments, project dimensions, asset
capitalization/depreciation/disposal. Each slice gets lifecycle, idempotency,
reversal, control reconciliation, and closed-period tests.

### Stage 7 — Read models and legacy contraction

Switch each report only after its normalized query and reconciliation tests pass.
Disable generic financial routes by allowlist. Archive legacy rows after backup,
restore rehearsal, accountant sign-off, and a separately approved window. Keep
`resource_records` for unfinished/non-financial resources until their own cutover.

## 20. Architecture invariants

Future Codex tasks and human changes must never violate these rules:

1. A draft or approved-but-unposted document never affects GL, AR, AP,
   inventory quantity/value, bank/cash balance, or financial reports.
2. Every financial effect is caused by an explicit authorized posting action.
3. Modules never insert, update, or delete journal lines directly.
4. `PostgresLedgerRepository.writePosting` is the single canonical GL writer and
   is reached through the shared posting service.
5. Posted financial documents and posted subledger/GL facts are immutable.
6. Corrections use reversal, void-with-reversal, credit, or adjusting entries;
   historical facts are never overwritten or hidden.
7. Document, required subledger effects, inventory movements, GL, idempotency,
   and audit commit atomically in one PostgreSQL transaction.
8. Every posting is balanced, idempotent, source-linked, tenant-scoped, branch-
   authorized, currency-complete, and inside an allowed fiscal period.
9. No matching fiscal period means posting fails.
10. Account mappings use semantic meanings and validated profiles, never
    hardcoded account numbers in feature modules.
11. Control accounts reject ordinary manual posting.
12. AR, AP, and inventory subledgers reconcile exactly to their GL control
    accounts for every reporting cutoff.
13. Bank/cash balances come from posted GL facts; inventory balances come from
    inventory movements; party balances come from their subledgers.
14. Exactly one canonical source exists for every financial fact.
15. Projections are rebuildable and never silently override canonical facts.
16. Money, quantity, rates, tax, and percentages never use JavaScript floating-
    point domain arithmetic.
17. Excess precision is rejected or explicitly rounded; it is never silently
    truncated.
18. Posted multi-currency facts retain transaction and functional amounts plus
    the historical exchange-rate context.
19. Reports consume posted normalized facts and never repair transactional data.
20. Unsupported reports remain explicitly unsupported; no silent fallback is
    permitted.
21. UUIDs are identifiers, not report or UI labels; read models join names and
    document numbers.
22. Soft deletion applies only to drafts and eligible master data. Posted facts
    remain permanently visible to registers, audit, and reconciliation.
23. Audit events are append-only and include actor, request, tenant, branch,
    action, source, and before/after or posting context.
24. External side effects use an outbox and may not weaken the financial commit.
25. `resource_records` is transitional only; no new financial module may choose
    JSONB as its production source of truth.
26. A migrated slice disables its old generic writes only after backfill,
    reconciliation, rollback, tenant, and accountant acceptance gates pass.

## 21. Recommended implementation phases

| Phase | Outcome | Exit gate |
| --- | --- | --- |
| 1. Architecture contract | Shared target and prohibited shortcuts | Architecture approval |
| 2. Accounting-core hardening | Required periods, account resolver/profiles, functional amounts, PostgreSQL race tests | Posting/reversal/closed-period suite passes |
| 3. AR stabilization | Payments, allocations, credits, cash sales, void protection, relational cutover | AR=control; full/partial/unapplied/reversal fixtures pass |
| 4. AP stabilization | Bills, expenses, credits, vendor payments and allocation | AP=control; three-way accounting fixtures pass |
| 5. Inventory completeness | Receipts, issues, returns, transfers, adjustments, landed cost | Valuation=Inventory Asset; quantity/value rebuild passes |
| 6. Banking completeness | Deposits, transfers, fees, statements, reconciliation | Each bank register=GL; reconciliation fixtures pass |
| 7. Payroll/projects/assets | Normalized posting adapters and dimensions | Liability, project, and asset roll-forwards reconcile |
| 8. Reporting/read models | TB, GL, P&L, BS, aging, valuation, cash flow from posted facts | Cross-report reconciliation and bounded export tests pass |
| 9. Contract legacy storage | Generic financial writes disabled and approved rows archived | Backup/restore rehearsal and accountant sign-off |
| 10. Production readiness | Observability, close procedure, security, backup, performance | Production-shaped E2E and formal release approval |

The safest first implementation after approval is Phase 2 accounting-core
hardening, immediately followed by the AR payment/allocation vertical slice.
Those steps stop the highest-risk split-brain behavior before additional feature
work expands the number of financial paths.
