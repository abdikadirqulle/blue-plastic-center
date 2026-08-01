# Reporting read-model design

## Purpose

Reports must never substitute a convenient dataset for the report the user
selected. Every report name is registered against one explicit read model. A
report without that read model is shown as **Coming soon** and the API returns
`REPORT_NOT_IMPLEMENTED`; it must not fall back to Trial Balance, Audit Trail,
aging, or another report.

The UI registry lives in
`apps/web/features/reports/report-registry.ts`. The API registry and execution
strategy live in `apps/api/src/modules/reports/report-registry.ts`.

## Canonical query dimensions

Every financial report query carries these dimensions even when the initial UI
uses company defaults:

- `companyId` from the authenticated request context (never from request body)
- permitted `branchIds`, or all authorized branches
- `from` and `to`, with an explicit inclusive date policy
- accounting basis (`accrual` or `cash`)
- presentation currency and exchange-rate policy
- fiscal period and closed-period visibility
- deleted/reversed/voided-state policy

Amounts cross service boundaries as decimal strings. Query aggregation uses
exact numeric values or integer minor units, never JavaScript floating point.

## Ledger read models

### Trial Balance

Source: posted, non-reversed accounting transactions joined to accounting
lines and chart-of-account metadata.

Group by company, branch scope, account id, account number, account name, and
account type. Return debit, credit, and normal-balance-aware balance. The debit
and credit control totals must match.

### Profit and Loss

Source: the same posted ledger facts, restricted to income, cost-of-goods-sold,
and expense accounts inside the requested period. Do not reuse a persisted
Trial Balance response. Produce sections and subtotals from account metadata.

### Balance Sheet

Source: posted ledger facts from inception through `to`, restricted to asset,
liability, and equity accounts. Current-period earnings must be derived from
income and expense facts and presented in equity without creating a posting.

### General Ledger

Required source: transaction-and-line detail, not account aggregates. Each row
must include posting date, transaction/document number, source module/type/id,
memo, account, debit, credit, and running balance. Until this query exists,
General Ledger remains explicitly unsupported.

### Cash Flow

Target source: ledger facts classified by operating, investing, and financing
cash-flow metadata plus opening/closing cash reconciliation. Filtering the
Trial Balance to account names containing “cash” is only a temporary summary
and must not be extended to Cash Flow Detail.

## Subledger read models

### Accounts receivable aging

Source normalized invoices, credit memos, payments, and payment allocations.
Compute open amount as document total minus allocated payments and credits as
of `to`. Join customer names and document numbers in SQL/repository projection;
never expose UUID foreign keys as report labels. Aging buckets are based on due
date and the report as-of date.

### Accounts payable aging

Mirror receivables using bills, vendor credits, bill payments, and allocations.
Join vendor and bill display identifiers in the projection.

### Sales by customer/item

Source normalized posted invoices and invoice lines. Customer summary groups by
customer id while returning customer display name. Item summary groups by item
id while returning item name, quantity, net sales, cost, and margin. Detail
reports require their own row-level projections and must not reuse summary
results.

### Inventory valuation

Source inventory movements/cost layers through `to`, grouped by item and
warehouse. Return quantity on hand, unit cost method, and exact extended value.
The valuation total must reconcile to the inventory control account.

## Performance and correctness

- Query only normalized tables; generic resource JSONB is a migration source,
  not the production reporting contract.
- Tenant predicates are mandatory on every table/join.
- Use keyset pagination for detail reports and bounded exports.
- Add indexes beginning with company and report-selective dimensions such as
  posting date, source tuple, customer/vendor, item, warehouse, and status.
- Cache only with a key containing every canonical query dimension and a ledger
  watermark. Posted/reversed transactions invalidate affected periods.
- Every report integration test must prove tenant isolation, date boundaries,
  reversal handling, human-readable joined names, exact totals, and empty state.

## Delivery sequence

1. Replace invoice-list and sales summaries with normalized invoice projections.
2. Implement transaction-detail General Ledger and enable its registry entry.
3. Replace receivable/payable aging with allocation-aware normalized queries.
4. Implement inventory movement valuation and ledger reconciliation.
5. Add cash-basis transformations and classified statement of cash flows.
6. Enable each remaining report only after its contract and reconciliation tests
   pass; never enable a report by aliasing another report kind.

