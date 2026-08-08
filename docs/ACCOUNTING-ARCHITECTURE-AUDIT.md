# BLUE PLASTIC CENTER — Accounting Architecture Audit

**Audit type:** READ-ONLY  
**Date:** 2026-08-08  
**Scope:** Backend schema, posting engine, sales/purchasing/inventory/banking flows, read models, reports, money precision, docs vs code  
**Constraint:** No code, migrations, or refactors were made as part of this audit.

---

## 1. Executive Summary

BLUE PLASTIC CENTER has a **real relational general ledger** (`accounting_transactions` / `accounting_lines`) and a **mostly single posting funnel** (`PostgresLedgerRepository.writePosting`). Invoice posting (AR + revenue + tax + COGS + inventory) is the strongest end-to-end path.

The books are **not yet reliable as a QuickBooks-style system** because:

1. **Subledgers and GL diverge** — customer payments post to GL without updating invoice balances or writing dedicated payment tables.
2. **Drafts can hit the ledger** — sales receipts post GL on create regardless of draft status.
3. **AP has almost no GL** — bills, expenses, and bill payments are mostly JSON CRUD; vendor “open balance” includes drafts and is not ledger-backed.
4. **Dual storage** — chart of accounts and some masters dual-write; journals, payments, bills still live primarily in `resource_records` JSON.
5. **Reports mix safe ledger summaries with unsafe float aggregations** and aging from manual `debts/*` resources.
6. **Banking transfer posting exists as a mapper but is unwired.**

**If feature work stopped today**, stabilize in this order: (1) posting/lifecycle invariants, (2) AR cash application + invoice money fields, (3) AP bill post + payments, (4) cash sale / inventory completeness, (5) reports from posted facts only, (6) finish relational migration off JSON for money docs.

---

## 2. Current Architecture Map

```text
Web (React/Vite)
  → Fastify REST API
    → ResourceService (generic CRUD + side-effect posts)
    → InvoiceService / Sales routes (allocate)
    → Accounting routes (journal post/reverse, periods)
    → PostingEngine.createBalancedJournalEntry
    → LedgerRepository.writePosting  ★ canonical GL writer
    → PostgreSQL
      ├── Dedicated: accounts, accounting_*, invoices, inventory_*, customers, …
      └── Transitional: resource_records (JSON) for journals, payments, bills, banking, …
    → RecordReadModel (balances/activity on read)
    → Report routes (ledger-summary | sales | operational | audit)
```

**MVP gate:** `packages/types/src/mvp-scope.ts` — UI/API hide banking screens, credit notes, POs, inventory adjustments/transfers, etc., but much of that code still exists.

---

## 3. Database Map

### Dedicated relational tables (production-oriented)

| Table | Purpose | Company | Branch | Money | Notes |
|-------|---------|---------|--------|-------|-------|
| `companies` / `branches` / `users` / `sessions` | Tenant & auth | yes | branch as entity | — | Session + CSRF |
| `accounts` | Chart of accounts | yes | no | currency code only | Dual-shadowed to `resource_records` |
| `fiscal_periods` | Open/close periods | yes | no | — | Status text; **no CHECK** |
| `accounting_transactions` | Journal headers | yes | **required** | `exchange_rate` numeric(20,8) | Status CHECK: draft/posted/reversed/voided |
| `accounting_lines` | Journal lines | via txn | — | debit/credit numeric(20,4) | One-side CHECKs; balance equality **app-only** |
| `posting_idempotency_keys` | Posting idempotency | yes | — | response JSON | |
| `customers` / `vendors` | Party masters | yes | optional | opening balances | Opening ≠ open balance |
| `invoices` / `invoice_lines` | Credit sales | yes | yes | totals numeric(20,4) | Relational MVP path |
| `customer_payments` / `customer_payment_allocations` | A/R payments | yes | yes | amounts | **Tables exist; live allocate path does not write them** |
| `items` / `warehouses` | Inventory masters | yes | — | prices | |
| `inventory_balances` / `inventory_movements` | Stock subledger | yes | movements yes | qty/cost/value | WAC costing |
| `currencies` / `tax_codes` / `payment_terms` / `document_sequences` | Setup | yes | — | rates | Multi-currency deferred in MVP |
| `company_settings` | Fiscal year / basis | company PK | — | — | |
| `audit_events` | Immutable audit | company | — | — | |
| `resource_records` | Transitional JSON store | yes | yes | inside JSON | Journals, bills, payments, banking, debts, … |
| `idempotency_keys` / `attachments` / `background_jobs` / `migration_exceptions` | Platform | varies | — | — | |

**Evidence:** `apps/api/src/db/schema.ts`; migrations `0000`–`0010`.

### Transitional / JSON accounting surfaces

Still primarily `resource_records` for MVP-reachable money docs:

- `accounting/journal-entries` (document lifecycle; GL is relational after post)
- `sales/payments`, `sales/sales-receipts`
- `purchasing/bills`, `bill-payments`, `expenses`
- `debts/receivables`, `debts/payables` (aging + control recon)
- Banking resources (MVP-hidden)

### Duplicated sources of truth

| Concern | Sources that can disagree |
|---------|---------------------------|
| Chart of accounts | `accounts` table + `resource_records` shadow |
| Posted journal | `accounting_*` + journal row status in `resource_records` |
| Customer payments | GL lines vs JSON payment allocations vs unused `customer_payments` tables vs `invoices.amountPaid` |
| Vendor balances | Bill JSON outstanding (incl. drafts) vs GL AP (often never posted) |
| A/R aging | `debts/receivables` JSON vs invoice open amounts |
| Inventory value | `inventory_balances` vs Inventory Asset GL (opening + invoice COGS only) |

---

## 4. Current Posting Architecture

### Canonical writer

**YES — one production insert path for ledger lines:**

`createBalancedJournalEntry` / `validatePostingCommand`  
→ `LedgerRepository.post` / `postInTransaction`  
→ **`PostgresLedgerRepository.writePosting`**  
(`apps/api/src/modules/accounting/postgres-ledger-repository.ts`)

Enforces: ≥2 lines, equal debits/credits (bigint minor units scale 4), closed-period rejection, account resolution (id / number / systemKey), control-account / `allowManualPosting` rules for manual posts, idempotency keys, audit events.

### Callers that correctly use the engine

| Caller | File | Effect |
|--------|------|--------|
| Invoice post / void | `postgres-invoice-repository.ts` | Full invoice + COGS + inventory |
| Payment allocate | `sales.routes.ts` | DR bank / CR AR |
| Cash sale create | `resource-service.ts#postCashSale` | DR bank / CR revenue |
| Item opening stock | `resource-service.ts#seedItemOpeningStock` | DR inventory / CR equity |
| Journal post/reverse HTTP | `accounting.routes.ts` | Manual JE |

### Outside / adjacent paths

| Path | Risk |
|------|------|
| `apps/api/src/db/seed.ts` direct `insert(accountingTransactions/Lines)` | Bypasses engine (seed only) |
| `operational-workflow.service.ts#createDraftPosting` | Draft JE in JSON only until posted |
| `purchasing.routes` bill approval → draft JE hardcodes accounts `6000`/`2000` | Wrong economics if re-enabled |
| `bank-transfer-posting.ts#mapBankTransferPosting` | **Mapper only; no route posts it** |
| Memory ledger | Tests only |

**Answer:** There is **one canonical GL write path** at runtime (`writePosting`). There is **not** one canonical business-document posting lifecycle — modules still invent side effects (cash sale on create, payment allocate without invoice update, AP without post).

---

## 5. Transaction Lifecycle Findings

**Documented ideal (ACCOUNTING-RULES):** drafts never affect GL; posted immutable; corrections via reversal.

| Rule | Actual | Verdict |
|------|--------|---------|
| Drafts do not affect GL | Sales receipts post on create (`postCashSale`) with no status gate | **VIOLATION** |
| Drafts do not affect party balances | Vendor balances `includeDrafts: true`; invoices exclude draft | **Partial** |
| Draft payments do not affect balances | `isPosted` excludes `draft` in read-model (fixed path) | OK for register; allocate moves to `applied` |
| Posted cannot edit | Invoice `canEditInvoice` draft-only | OK for invoices |
| Posted cannot delete | Soft-delete draft-only for invoices | OK |
| Reversals create opposite effects | `createReversalCommand` / void invoice | OK for invoices |
| Void after payment | `canVoidInvoice` allows paid/partial without unwinding payments | **VIOLATION risk** |
| Closed periods block posting | `writePosting` checks closed fiscal periods | OK when period rows exist |
| No period row | Posting allowed with `fiscalPeriodId` null | **Gap** (UNVERIFIED prod policy) |

Consistent status machine `DRAFT → APPROVED → POSTED → REVERSED` is **not** universal. Common statuses: `draft`, `open`, `incomplete`, `applied`, `posted`, `voided`, `reversed`.

---

## 6. Sales Trace

### Credit invoice

```text
UI → POST/PATCH /v1/sales/invoices
  → InvoiceService → PostgresInvoiceRepository
  → POST …/post
  → buildInvoicePosting → ledger.postInTransaction
  → inventory apply (sale) + accounting_* + invoices.status=open
```

**Expected:** Dr AR / Cr Revenue (+ tax / discounts); Dr COGS / Cr Inventory for stocked lines.  
**Actual:** Matches for posted invoices (`invoice-posting.ts`). Drafts do not post. **Good.**

### Cash sale (sales receipt)

```text
UI → POST /v1/sales/sales-receipts
  → ResourceService.create → postCashSale → ledger.post
```

**Expected:** Post only when finalized; Dr Bank / Cr Revenue; inventory/COGS if stocked.  
**Actual:** Posts on create; no COGS/stock; status typically `draft`. **CRITICAL.**

### Customer payment / partial allocation

```text
UI → create payment (JSON) → POST /v1/sales/payments/:id/allocate
  → resources.update status=applied + allocations
  → ledger.post Dr Bank / Cr AR (full payment.amount)
```

**Expected:** Update invoice `amountPaid`/`balanceDue`/status; write payment+allocation tables; GL = applied amount; AR subledger = control.  
**Actual:** GL posts; **does not** update invoice money fields; **does not** write `customer_payments*`; no invoice/customer validation. **CRITICAL split-brain.**

### Credit note / return

MVP-excluded; no posting path found. **UNVERIFIED / not implemented.**

### Invoice void

```text
POST …/invoices/:id/void → reverseTransactionInTransaction + inventory restore
```

**Expected:** Block or reverse applied payments first.  
**Actual:** Can void paid invoices → AR double-relief risk. **CRITICAL.**

---

## 7. Purchasing Trace

### Bill

```text
UI → ResourceService CRUD → resource_records
```

**Expected:** On post: Dr Expense/Inventory / Cr AP.  
**Actual:** No MVP post to GL. Vendor open balance from bill JSON (`includeDrafts: true`). **CRITICAL for AP books.**

Deferred approval can create draft JE with hardcoded `6000`/`2000` (wrong).

### Bill payment / expense

CRUD only; no `ledger.post` hooks found. Read-model may treat non-draft as affecting vendor balance without GL.

### PO / goods receipt

Receive workflow creates receipt JSON; **no** inventory movement / GL. Outside MVP.

---

## 8. Inventory Trace

| Event | Path | Stock | GL |
|-------|------|-------|----|
| Invoice post (inventory/assembly) | `WeightedAverageInventoryCosting` + movements | Yes | COGS + Inventory Asset |
| Invoice void | Restore movements | Yes | Reversal |
| Item opening qty | `seedItemOpeningStock` | Yes | Dr Inventory / Cr Owner capital |
| Sales receipt | — | **No** | Revenue only |
| Transfer / adjustment | Code/kinds exist | **Unwired / out of MVP** | — |
| PO receipt | Status only | **No** | — |

Inventory valuation report reads operational stock-levels; GL Inventory Asset only moves on opening + invoice COGS paths → **recon risk**.

---

## 9. Banking Trace

| Workflow | Status |
|----------|--------|
| Deposit | Prefix/CRUD; no auto-post found |
| Transfer | `mapBankTransferPosting` **unwired** (unit tests only) |
| Reconciliation | Status → reconciled; no GL |
| Bank rules | Stub (`matchedTransactions: 0`) |
| MVP UI | Banking module **not navigable** |

---

## 10. AR / AP / Subledger Findings

| Subledger | Proper ledger? | = Control account? |
|-----------|----------------|--------------------|
| **AR** | Partial: invoices relational; payments JSON + GL; dedicated payment tables unused | **No** — allocate credits AR without invoice paid update; recon uses `debts/receivables` not invoices |
| **AP** | Document JSON only in MVP | **No** — little/no AP GL; vendor balance ≠ account 2000 |
| **Inventory** | Movements/balances solid when wired | **Partial** — not all stock events post; valuation vs GL can diverge |
| **Bank/cash** | GL lines on payment/cash sale; bank module unwired | Incomplete |
| **GL** | Strong relational core | OK for posted lines via engine |

Control-account reconciliation (`accounting.routes.ts`) compares GL 1100/2000 to **`debts/*` JSON**, not invoices/bills. That cannot prove AR/AP integrity.

---

## 11. Balance & Read Model Findings

**Central enricher:** `apps/api/src/modules/read-models/record-read-model.ts` + `balance-math.ts`.

| Balance | Source | Issues |
|---------|--------|--------|
| Customer open/overdue | Posted invoices − payment allocations (`netPayments`) | Ignores unused payment tables; depends on JSON allocations |
| Vendor open | Bills (incl. drafts) − bill payments | Drafts inflate AP; no GL |
| Account balance | Trial balance from ledger (`posted`+`reversed` kept for netting) | Correct approach for GL |
| Invoice open | `invoices.balanceDue` column | Not updated by payment allocate |
| Item on hand / value | `inventory_balances` | Opening + sales only in practice |
| Frontend workspace “Total value” | `sumDecimals` over list rows | Display aggregate OK if API money is honest |

**Opening balance vs open balance**

- **Opening balance:** form field on customer/vendor (setup).  
- **Open balance:** calculated activity metric.  
- Detail UI now hides setup `openingBalance` when viewing (`detailHiddenFields`) — correct direction; list still must never treat opening as open.

---

## 12. Reporting Findings

**Registry:** `apps/api/src/modules/reports/report-registry.ts`

| Report | Strategy | Safe for accounting? |
|--------|----------|----------------------|
| trial-balance | ledger-summary | **Mostly yes** (posted ledger facts; bigint in ledger layer) |
| profit-and-loss | filter TB by income/expense/COGS | **Approximate** — not a full P&amp;L presentation; period filtering via TB API |
| balance-sheet | filter TB by asset/liability/equity | **Approximate** |
| cash-flow | filter TB for cash/bank **by name** | **UNSAFE** — not a cash-flow statement |
| audit-trail | audit events | OK as activity log |
| sales-by-item / customer | sales strategy + **`Number()` float** | **UNSAFE** money math |
| invoice-list / collections | sales | Depends on invoice fields; payment sync broken |
| receivables/payables aging | `debts/*` operational | **UNSAFE** — not derived from invoices/bills |
| inventory-valuation | stock-levels | Operational; may disagree with GL |
| general-ledger | unsupported → `REPORT_NOT_IMPLEMENTED` | Correct refusal (no silent fallback) |

**Docs say:** never substitute another report; posted facts; no float.  
**Code does:** registry blocks unknown/unsupported; cash-flow/aging/sales aggregates violate spirit.  
**Risk:** management decisions from wrong cash-flow/aging; float totals drift.

---

## 13. Money Precision Findings

### Compliant (engine path)

- `ledger-math.ts` bigint scale 4  
- `posting-engine.ts` / `invoice-posting.ts` / `balance-math.ts`  
- Web `sumDecimals` / `formatDecimal` for display math  

### Violations / risks

| Location | Issue | Severity |
|----------|-------|----------|
| `report.routes.ts` sales-by-item/customer | `Number(qty)*Number(price)`, `.toFixed(2)` | **CRITICAL** for report money |
| `operations/money.ts#toScaled` | Truncates >4 decimals via `.slice(0,4)` | **HIGH** |
| Guards using `Number(amount) <= 0` | invoice post, payment allocate, cash sale, expense UI | **MEDIUM** (gate only) |
| `report-viewer-page.tsx` / export `toFixed(2)` | Float display path | **MEDIUM** |
| Seed direct ledger inserts | Bypass validation | **LOW** (seed) |

No `parseFloat` found under `apps/api` (good).

---

## 14. Duplicate / Coupled Logic

| Concern | Locations | Should consolidate to |
|---------|-----------|------------------------|
| Build balanced JE | invoice-posting, sales allocate, postCashSale, seedItemOpeningStock, bank-transfer mapper | Shared document posting adapters → engine only |
| Party balances | balance-math + record-read-model | One AR/AP service from posted docs |
| Line totals | operations/money, invoice-totals, web forms | Shared money lib (reject vs truncate policy) |
| Account resolution | system keys + per-form account pickers | System account registry + posting profiles |
| Draft JE creation | operational-workflow, payroll, purchasing approval | Either remove or route through engine as draft status in `accounting_transactions` |
| Status “posted” semantics | `isPosted`, invoice domain, resource statuses | Single document state machine |

---

## 15. Accounting Rule Violations

| Rule (docs/ACCOUNTING-RULES.md) | Evidence | Severity |
|----------------------------------|----------|----------|
| 1 Balanced journals | Enforced in engine | OK |
| 2 Posted immutable | Invoices OK; JSON docs weaker | HIGH |
| 3 Reversal corrections | Invoice void OK; payment unwind missing | CRITICAL |
| 4 Drafts ≠ GL | `postCashSale` on create | CRITICAL |
| 5 Posting context | Engine records company/branch/actor/date | OK |
| 6 Closed periods | Checked in writePosting | OK / gap if no period |
| 7 Subledger = control | AR/AP/debts recon fail | CRITICAL |
| 8 Inventory traceability | Invoice path OK; PO/receipt missing | HIGH |
| 9 Multi-currency | Deferred; rate stored, conversion thin | MEDIUM |
| 10 Reports from posted lines | TB yes; sales float + aging debts no | CRITICAL |
| 11 SoD | RBAC exists; not fully workflow-separated | MEDIUM |
| 12 Audit | audit_events on posts | Mostly OK |

---

## 16. Risk Matrix

| ID | Finding | Severity | Area |
|----|---------|----------|------|
| R1 | Payment allocate ≠ invoice money / payment tables | CRITICAL | AR |
| R2 | Sales receipt posts while draft | CRITICAL | Sales/GL |
| R3 | Void invoice after payment without payment reverse | CRITICAL | AR/GL |
| R4 | AP bills/expenses/payments without GL | CRITICAL | AP |
| R5 | Aging/control recon from `debts/*` not invoices/bills | CRITICAL | Reports/recon |
| R6 | Sales reports use JS float aggregation | CRITICAL | Reports |
| R7 | Cash-flow report is TB cash filter | HIGH | Reports |
| R8 | Vendor balances include drafts | HIGH | AP |
| R9 | Sales receipt no COGS/stock | HIGH | Inventory |
| R10 | Bank transfer mapper unwired | HIGH | Banking |
| R11 | Journal docs still JSON dual-representation | HIGH | Architecture |
| R12 | `money.ts` truncates decimals | HIGH | Money |
| R13 | `accounts.parent_id` no FK | MEDIUM | Schema |
| R14 | Fiscal period missing → post allowed | MEDIUM | Periods |
| R15 | Seed bypasses posting engine | LOW | Seed |

---

## 17. Top 10 Highest-Risk Problems

1. **AR split-brain** — GL payment CR AR without updating invoices or writing `customer_payments`.  
2. **Draft cash sales hit GL** — violates draft rule; books include unfinalized sales.  
3. **AP without ledger** — vendor statements ≠ trial balance AP.  
4. **Invoice void vs applied payments** — can corrupt AR.  
5. **Aging / control accounts from wrong store (`debts/*`)**.  
6. **Float money in sales report aggregations**.  
7. **Fake cash-flow report**.  
8. **Inventory incomplete posting** (cash sales, POs, adjustments).  
9. **JSON journal + relational GL dual lifecycle**.  
10. **Banking posting unused while cash moves via ad-hoc sales/payment posts.**

---

## 18. Recommended Stabilization Order

*Do not implement here — sequence only.*

### First — Stop incorrect books (foundation)

1. Gate **all** automated `ledger.post` calls on explicit post/apply status (fix cash sale).  
2. Make **payment allocate** write `customer_payments` + allocations, update invoice `amountPaid`/`balanceDue`/status, and post GL for applied amount only.  
3. Block **void** when applied payments exist (or reverse payments first).  
4. Exclude drafts from vendor balances; stop treating incomplete AP docs as AP.

### Second — Close AR/AP = control accounts

5. Post **bills** to AP (Dr expense/inventory, Cr AP) via engine.  
6. Post **bill payments / expenses** to GL and allocate to bills.  
7. Point aging + control recon at invoices/bills, retire `debts/*` as source of truth.

### Third — Inventory & banking completeness

8. Cash sale: optional inventory/COGS; or forbid stocked items until post-style workflow.  
9. Wire bank transfer mapper; deposits as postings.  
10. PO receive → stock (+ optional accrual).

### Fourth — Reporting & migration

11. Rewrite sales aggregates with minor-unit math; replace cash-flow or mark unsupported.  
12. Move journals/payments/bills off `resource_records` per `RELATIONAL-MIGRATION.md`.  
13. Accountant sign-off: CoA, opening balances, close procedure, TB/P&amp;L/BS.

---

## Documentation vs Code

| Documentation says | Code currently does | Risk |
|--------------------|---------------------|------|
| Modules never write journal lines directly; only via engine | Runtime inserts only in `writePosting`; seed bypasses | Low in runtime; seed exception |
| Drafts do not affect GL | Sales receipts post on create | Incorrect books |
| Subsidiary ledgers reconcile to control accounts | Recon uses `debts/*`; payments don’t update invoices | False confidence / misstatement |
| Reports from posted journal lines; no silent fallback | GL reports mostly OK; cash-flow/aging/sales float wrong | Bad decisions |
| Money as decimal strings / minor units | Engine OK; reports + some guards use `Number` | Drift |
| `resource_records` transitional only | Still system of record for payments, bills, journals UX | Dual truth |
| Banking transfers postable | Mapper exists, unwired | Dead code / incomplete treasury |
| Frontend must not compute balances | Workspace totals use `sumDecimals` on API figures (OK); detail opening vs open historically confused | Mostly display |

---

## UNVERIFIED

- Production timezone behavior of `new Date("YYYY-MM-DD")` in `writePosting`.  
- Whether any deployed env still exercises payroll/purchasing approval draft JE paths behind MVP gates.  
- Whether all DBs fully applied/validated migration 0007 constraints.  
- Functional-currency conversion beyond storing `exchangeRate`.  
- Frontend always creates sales receipts as `draft` (backend posts either way if amount &gt; 0).  
- Exact seed dataset parity with control accounts after live posting.

---

## Bottom line

> **If we stopped feature development today and wanted a reliable QuickBooks-style system, what must we fix first, second, third?**

1. **First:** Enforce draft ≠ GL and make **AR cash application** update invoices + payment tables + GL together (and protect void). Without this, the ledger lies relative to customers.  
2. **Second:** Implement **AP bill/expense/payment posting** so payables match the trial balance.  
3. **Third:** Make **reports and recon** consume only posted invoice/bill/ledger facts (kill debts-based aging and float sales totals; fix or disable cash-flow).

Everything else (banking wire-up, full relational migration, workers/PDF) builds on that foundation.
