# Accounting Rules

These rules are architectural invariants, not optional UI behavior.

1. Every posted journal is balanced: total debit equals total credit.
2. Posted financial transactions are immutable.
3. Corrections use reversal, void-with-reversal, or adjusting entries. A reversed
   entry stays in the books beside its reversal; the pair nets to zero and
   neither side is ever hidden from a balance, a register, or a report.
4. Draft documents do not affect the general ledger.
5. Posting records the company, branch, currency, exchange rate, fiscal period,
   source document, actor, and timestamp.
6. Closed periods reject new postings unless an authorized controlled reopening
   occurs.
7. Subsidiary ledgers reconcile to their general-ledger control accounts.
8. Inventory quantity and inventory value movements remain traceable to source
   documents.
9. Multi-currency documents retain both transaction and functional-currency
   values.
10. Financial report totals must be reproducible from posted journal lines.
11. Authorization, approval, posting, and payment can be separated by role.
12. Audit history records before/after context for sensitive master-data changes.

Accounting workflows require review by a qualified accountant before production
use.

