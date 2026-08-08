# BLUE PLASTIC CENTER — Phase 2A Accounting Core Gap Analysis & Implementation Plan

**Status:** Planning only  
**Scope:** Shared Accounting Core  
**Primary contract:** `docs/ACCOUNTING-TARGET-ARCHITECTURE.md`  
**Evidence date:** 2026-08-08

This document compares the approved target architecture with the repository as it exists. It does not prescribe AR, AP, inventory, payroll, banking, or project feature behavior beyond identifying how those callers currently enter the Accounting Core. Claims not proven from the inspected repository are marked **UNVERIFIED**.

## 1. Executive Summary

The current core is not a blank slate. It already has a relational general ledger, exact scale-4 journal validation, one canonical PostgreSQL writer, a transaction-scoped posting port, database-backed idempotency, source-post fingerprints, audit events, and append-only reversals. `PostgresLedgerRepository.writePosting` should therefore remain the canonical GL persistence path.

The core is not yet safe enough to be the foundation for production subledgers. The highest-risk defect is that a posting with no matching fiscal period succeeds with `fiscal_period_id = NULL`. Overlapping periods can also make resolution ambiguous. Money arithmetic is duplicated, and two helpers silently truncate. Account resolution accepts three different reference styles and some callers still use hardcoded account numbers or raw IDs. Functional currency exists on the company, but GL lines store only one set of amounts and the writer neither resolves nor records the company functional currency. Company and branch IDs are authenticated, but several foreign keys are not company-safe at database level.

The safest sequence is to harden primitives and invariants before changing feature modules: canonical money first, then fiscal periods and account resolution, then posting-contract/currency changes, database constraints, and finally PostgreSQL concurrency/rollback tests. No Phase 3 AR work should start until Phase 2 exit criteria are met.

### Priority findings

1. **Target requires** every posting to resolve to exactly one open company period → **Current code does** two independent `.limit(1)` lookups and permits no match → **Gap** unperiodized and ambiguous postings are possible → **Required change** introduce one period resolver that fails on zero, more than one, or non-open matches and make `fiscal_period_id` mandatory after cleanup.
2. **Target requires** one exact, explicit money foundation → **Current code does** use `bigint` in the ledger but duplicates parsers/scales and silently truncates in operational/payroll helpers → **Gap** caller totals can disagree with GL totals → **Required change** consolidate parsing, arithmetic, scale, and rounding behind a shared canonical module.
3. **Target requires** business meaning → resolver → company account → **Current code does** allow account ID, account number, or `systemKey` directly in the posting command → **Gap** policies are spread across callers and the writer → **Required change** add an `AccountResolver`, retain existing item/customer/vendor/tax mappings, and remove account-number fallback from automated posting.
4. **Target requires** explicit transaction and functional currency facts → **Current code does** persist transaction currency and one rate but only one debit/credit pair → **Gap** historical functional amounts cannot be reproduced independently → **Required change** resolve company functional currency, freeze rate provenance, and persist both amount sets using an incremental migration.
5. **Target requires** database-backed concurrency invariants → **Current code does** enforce idempotency key and fingerprint uniqueness, but uses random journal numbers and has no unique reversal constraint → **Gap** most retry safety is good, while numbering and double-reversal protection need stronger DB semantics → **Required change** allocate journal numbers through the existing company document-sequence pattern and add a partial unique reversal constraint.

## 2. Current Accounting Core Map

### Runtime flow

```text
Authenticated Fastify request
  → createRequestContextPlugin (company, branch, actor, request ID)
  → feature/application caller builds PostingCommand
  → LedgerRepository.post(...) OR postInTransaction(...)
  → validatePostingCommand / assertBalanced
  → postingRequestHash + postingFingerprint
  → posting_idempotency_keys claim
  → PostgresLedgerRepository.writePosting
      → reversal/source checks
      → fiscal-period lookup
      → account lookup and manual-control restriction
      → accounting_transactions insert
      → accounting_lines insert
      → audit_events insert
  → idempotency result marked completed
  → transaction commit
```

### Responsibility map

| Responsibility | Current file / symbol | Assessment |
|---|---|---|
| Request identity | `apps/api/src/plugins/request-context.ts` — `createRequestContextPlugin` | Auth-derived company, branch, actor and request ID |
| Posting contract/validation | `apps/api/src/modules/accounting/posting-engine.ts` — `PostingCommand`, `PostingResult`, `validatePostingCommand` | Central metadata and balance validation |
| Balanced journal creation | same file — `createBalancedJournalEntry`; `ledger-math.ts` — `assertBalanced` | Exact scale-4 validation |
| Money primitives | `ledger-math.ts`; also `operations/money.ts`, `sales/invoice-totals.ts`, `packages/types/.../payroll.ts` | Duplicated and inconsistent |
| Public posting boundary | `postgres-ledger-repository.ts` — `post` | Opens a Drizzle transaction |
| Composable posting boundary | same file — `postInTransaction` | Allows source/subledger/GL/audit atomicity |
| Canonical ledger persistence | same file — private `writePosting` | Correct component to retain |
| Journal numbering | same file — `JOU-${randomUUID().slice(...)}` | Unique but not sequential or retry-oriented |
| Account meanings | `system-accounts.ts`; `accounts.systemKey` | Partial vocabulary and company mapping |
| Account resolution | `writePosting` inline query | ID, number, or system key; no dedicated resolver |
| Control-account restriction | `writePosting(..., manual)` | Manual-only restriction is present |
| Fiscal periods | `schema.ts` — `fiscalPeriods`; repository `closePeriod`, `reopenPeriod`, `writePosting` | Missing exact-one invariant |
| Currency/rate | `PostingCommand`; `accountingTransactions.currency/exchangeRate`; `companies.functionalCurrency` | Transaction metadata only; functional line amounts absent |
| Reversal command | `posting-engine.ts` — `createReversalCommand` | Swaps line sides and preserves currency/rate |
| Reversal persistence | repository — `reverseTransactionInTransaction`, `reverseJournal` | Same transaction, linked, original retained |
| Idempotency | `posting_idempotency_keys`; `postingRequestHash`; `postingFingerprint` | Strong base with DB uniqueness |
| Audit | `audit_events`; inserts in posting/reversal | Actor/request scope exists; result/reason detail incomplete |
| Transaction type/client | `apps/api/src/db/client.ts` — `Database`, `DatabaseTransaction`, `createDatabase` | PostgreSQL via `postgres-js`, `prepare:false` |

### Current callers that reach or prepare GL postings

- Invoice posting: `sales/invoice-posting.ts`, `sales/postgres-invoice-repository.ts`.
- Customer payment posting: `sales/sales.routes.ts` and generic paths in `services/resource-service.ts`.
- Sales-receipt/inventory generic posting: `services/resource-service.ts`.
- Bank transfer: `banking/bank-transfer-posting.ts`.
- Payroll: `payroll/payroll.routes.ts`.
- Projects: `projects/project.routes.ts`.
- Generic operational journals: `operations/operational-workflow.service.ts`.
- Manual journals: `accounting/postgres-ledger-repository.ts` through `postJournalInTransaction`.

## 3. Money Gap

### Finding 3.1 — multiple foundations

**Target requires** one canonical fixed-point/bigint money library → **Current code does** implement separate scale-4 conversions in `ledger-math.ts`, `operations/money.ts`, `sales/invoice-totals.ts`, and `packages/types/src/contracts/payroll.ts` → **Gap** arithmetic and validation behavior can diverge → **Required change** create one shared, dependency-light money module used by API domains and shared contracts where runtime validation needs arithmetic.

### Finding 3.2 — truncation and rounding

**Target requires** explicit rounding and no silent truncation → **Current code does** reject more than four decimals in `ledger-math.decimalToMinor`, silently slice extra digits in `operations/money.toScaled` and payroll's local helper, truncate division in operational line multiplication, and use positive half-up behavior in invoice multiplication → **Gap** the same inputs can be rejected, rounded, or truncated depending on route → **Required change** define named rounding modes, use the approved half-away-from-zero rule at declared boundaries, and reject excess precision at input boundaries unless an operation explicitly rounds.

### Finding 3.3 — JavaScript number usage

**Target requires** no JS float domain arithmetic → **Current code does** use `bigint` in journal math, but `Number` remains in operational/sales validation guards and report aggregation/formatting; report code also uses `.toFixed(2)` → **Gap** core persistence is exact but upstream/downstream results are not uniformly exact → **Required change** migrate financial domain comparisons/calculation to canonical money; permit `Number` only for non-authoritative visualization coordinates and explicitly documented presentation conversion.

No `parseFloat` usage was found in the inspected accounting/API module search. `.toFixed` was found in report formatting, not in canonical GL persistence.

### Canonical foundation recommendation

Use a single API such as `Money.parseExact`, `Money.add/subtract`, `Money.multiply`, `Money.divide`, `Money.round`, and `Money.format`, backed by `bigint`. Keep persisted/API values as decimal strings. Define separate scale policies: money 4, exchange rate 8, percentage 6, and quantity 4 unless a later inventory decision changes it. Do not expose raw scaled integers across module boundaries. Add signed-number correctness, negative half cases, overflow bounds, and excess-precision tests before migrating callers.

## 4. Account Resolution Gap

### Existing mechanisms

- `accounts.systemKey` is tenant-unique and already represents a minimum company-specific meaning mapping.
- `system-accounts.ts` currently defines AR, sales/service revenue, sales discounts, inventory asset, COGS, and tax payable.
- Items have income, expense, and inventory account IDs.
- Customers and vendors have receivable/payable account IDs.
- Tax codes have sales/purchase account IDs.
- Payments may carry a deposit account ID.
- Bank transfer posting accepts resolved ledger account IDs.
- Manual journals accept direct account IDs/numbers and apply control-account restrictions.

### Finding 4.1 — mixed resolution policy

**Target requires** business meaning → `AccountResolver` → company account → **Current code does** accept exactly one of `accountId`, `accountNumber`, or `systemAccountKey` and resolves it inside `writePosting` → **Gap** automated callers can bypass semantic configuration with raw IDs/numbers → **Required change** resolve meanings before persistence, return a validated company account ID plus resolution metadata, and make the writer accept resolved IDs only after a compatibility window.

### Finding 4.2 — incomplete vocabulary

**Target requires** meanings including AR, AP, revenue, inventory, COGS, tax, cash, bank, and mobile money → **Current code does** define only seven typed keys while callers also use string literals such as `bank` and `owner_capital` → **Gap** compiler coverage and configuration validation are incomplete → **Required change** extend one typed meaning registry and validate all required meanings at company setup/posting time.

### Finding 4.3 — callers to migrate

| Caller | Current reference | Migration direction |
|---|---|---|
| Invoice posting | item/customer IDs with system-key fallback | Preserve specific mappings; resolve fallback meanings centrally |
| Customer payment | deposit ID or literal `bank`, plus AR key | Resolve payment instrument/deposit account and AR meaning |
| Generic sales receipt | deposit ID or `bank`, revenue key | Resolve receipt profile and instrument mapping |
| Generic inventory/opening | inventory ID/key and literal `owner_capital` | Resolve inventory/opening-balance profile |
| Purchasing posting | hardcoded account numbers observed in purchasing route | Replace with AP/expense/inventory profile resolution |
| Reconciliation | hardcoded `1100`/`2000` observed in accounting route | Resolve AR/AP meanings before querying |
| Payroll/project/operational workflows | raw document account IDs | Validate IDs through resolver against company, type, active/control policy |
| Bank transfers | bank ledger IDs from bank accounts | Preserve specific mapping, add company-safe validation and instrument semantics |

Manual journal account-number entry may remain as a user-facing lookup, but it should be converted to a resolved account ID before the posting command reaches the writer. Seed-only account numbers are not runtime policy.

## 5. Posting Profile Gap

**Target requires** reusable company account mappings and event-specific posting profiles → **Current code does** provide `accounts.systemKey`, item/customer/vendor/tax mappings, and ad hoc payment/deposit references, but no `posting_profiles` or `posting_profile_lines` model was found → **Gap** event rules are embedded in feature code → **Required change** reuse existing specific mappings and introduce only the missing profile concepts.

Minimum later additions:

1. Treat `accounts.systemKey` as the initial company-wide meaning mapping; do not duplicate it immediately with an equivalent table.
2. Add `posting_profiles` keyed by company + event/profile code, with active/version/effective metadata.
3. Add ordered `posting_profile_lines` carrying debit/credit role, account meaning or allowed override type, amount basis, and required dimension policy.
4. Add payment-instrument/account mapping (cash, bank, mobile money) because a generic `bank` literal cannot identify multiple real accounts.
5. Reuse item, customer, vendor, and tax mappings; add company-safe integrity checks rather than parallel tables.

Profile expression language, user-editable formulas, and a generalized rules engine **should NOT be added yet**. Phase 2 needs deterministic typed profiles only.

## 6. Fiscal Period Gap

### Finding 6.1 — missing period

**Target requires** exactly one valid open company period → **Current code does** allow `period?.id` to be undefined and `fiscalPeriodId` is nullable → **Gap** financial postings can exist outside the period calendar → **Required change** replace both lookups with a single exact-one resolver and reject zero matches before any GL insert.

### Finding 6.2 — overlap and state

**Target requires** an unambiguous valid period → **Current code does** index dates but does not prevent overlap, does not check `startDate <= endDate`, and has no DB check for status values → **Gap** `.limit(1)` can choose an arbitrary period and unexpected status strings can be treated as postable → **Required change** add date-order/status checks and a PostgreSQL exclusion constraint for overlapping company date ranges, after auditing existing rows.

### Finding 6.3 — reversal date

**Target requires** reversals to obey period rules on the reversal date → **Current code does** send the reversal date through the same `writePosting` checks → **Gap** closed-period rejection works, but missing/overlapping-period defects also affect reversals → **Required change** use the same exact-one resolver for primary, adjustment, and reversal postings.

Smallest behavioral fix: fail if `period` is absent and fail if more than one row is returned. Smallest durable schema follow-up: clean data, set `fiscal_period_id NOT NULL`, then add period checks/exclusion.

## 7. Posting Contract Gap

| Target field/capability | Status | Current evidence / decision |
|---|---|---|
| Authenticated context | Already exists | `RequestContext` is passed separately; do not duplicate it inside command yet |
| Source module/type/ID | Already exists | Required and fingerprinted |
| Source version | Missing | Add to command/fingerprint when source adapters can supply it |
| Posting kind | Already exists | primary/reversal/adjustment |
| Idempotency key | Already exists | Request hash and DB claim exist |
| Transaction date | Already exists | Strict ISO-date validation |
| Transaction currency | Already exists | Three-letter uppercase validation only |
| Exchange rate | Partially exists | Positive scale-8 string; provenance and functional semantics absent |
| Account meaning | Partially exists | `systemAccountKey` exists but shares contract with IDs/numbers |
| Dimensions | Missing | Add typed optional branch/project/class/department/location fields only when persistence is prepared |
| Transaction amounts | Already exists | Debit/credit decimal strings |
| Functional amounts | Missing | Add with currency migration; do not infer forever at report time |
| Posting fingerprint | Already exists | Company + source tuple + kind; result returns it |
| Resolved period | Missing from result | Return period ID to improve auditability |
| Functional currency/rate provenance | Missing | Add when currency hardening lands |
| Large generic metadata bag | Should not be added yet | Prefer explicit fields and feature-owned source data |

**Target requires** a stable application contract → **Current code does** expose persistence-oriented account references and omits source version/financial context → **Gap** callers cannot prove which source revision and configuration produced a journal → **Required change** evolve the contract additively, introduce an adapter at callers, and version fingerprints deliberately so retries remain compatible during rollout.

## 8. Functional Currency Gap

### Present today

- `companies.functionalCurrency` stores company currency.
- Posting command/transaction stores transaction `currency` and a scale-8 `exchangeRate`.
- Accounts also carry a currency.
- Currency master rows store code, decimals, and one exchange rate.
- Accounting lines store only one scale-4 debit and credit pair.

### Missing today

- The writer does not load or validate company functional currency.
- Currency is syntactically validated but not checked against a company-active currency row.
- Rate meaning, source, quote date, and direction are not recorded.
- Transaction-currency and functional-currency line amounts are not separate.
- No explicit FX rounding/residual policy exists.
- Account currency compatibility is not checked.

**Target requires** frozen transaction and functional facts → **Current code does** store one amount pair plus a rate that reports must interpret → **Gap** historical functional results can change or be ambiguous → **Required change** incrementally add functional currency/rate metadata to the transaction and transaction + functional debit/credit to lines.

Smallest safe path:

1. First enforce `currency === company.functionalCurrency` and `exchangeRate === 1` for Phase 2 unless a proven existing foreign-currency transaction must be retained.
2. Audit existing rows and define the existing rate direction.
3. Add nullable functional columns, backfill same-currency rows exactly, quarantine ambiguous FX rows.
4. Dual-write and reconcile, then make columns required.
5. Only then enable controlled foreign-currency posting and explicit FX rounding lines.

The existence and correctness of production foreign-currency rows is **UNVERIFIED**.

## 9. Ledger Writer Review

### What `writePosting` already does correctly

- Runs only inside a caller-provided Drizzle transaction.
- Revalidates reversal existence, status, company, and source identity.
- Rejects postings in a matching closed company period.
- Detects an existing company/source/type/ID/kind posting.
- Resolves only active accounts in the authenticated company.
- Enforces control-account/manual-posting policy for manual journals.
- Inserts header, lines, and posting audit in one transaction.
- Relies on DB uniqueness as a second line of duplicate defense.

### Responsibilities that should remain

- Final invariant validation.
- Final resolved-account/company validation.
- Exact-one fiscal-period validation.
- Header/line persistence.
- Database conflict normalization.
- Posting audit creation.
- Returning immutable ledger identity/result.

### Responsibilities to move or add above it

- Feature event interpretation and amount-basis calculation.
- Posting-profile selection.
- Business meaning resolution and override policy.
- Source-document lifecycle/version validation.
- Business/subledger reversal coordination.
- Payment-instrument choice and item/tax policy.

No material feature-specific accounting rule has leaked into `writePosting`; its `manual` switch is a legitimate core policy. Inline account lookup should move behind an accounting-core resolver, not into feature modules.

### Defects to harden

- `fiscalPeriodId: period?.id` permits missing periods.
- Account-number fallback permits configuration bypass for automated calls.
- Balance is validated before resolution but not enforced as a whole-journal DB invariant.
- Journal number uses a UUID fragment rather than an atomic company sequence.
- Currency/company/account compatibility is not validated.
- Posting audit omits transaction ID/number, period, amount totals, and currency details.

## 10. Transaction / Atomicity Capability

**Target requires** document + subledger + inventory + GL + audit in one PostgreSQL transaction → **Current code does** expose `postInTransaction(DatabaseTransaction, ...)`, while `post(...)` opens its own transaction → **Gap** the core capability exists, but every future feature application service must use the transaction-scoped port and repositories must accept the same transaction object → **Required change** standardize transactional repository ports and prohibit calling `post()` from within an already-open business transaction.

The posting claim, duplicate checks, GL header/lines, audit, and completed idempotency response share the passed transaction. A thrown error should roll them all back under PostgreSQL/Drizzle semantics. Real PostgreSQL rollback behavior has not been integration-tested and is therefore **UNVERIFIED**.

Potential blockers before Phase 3 AR:

- Feature repositories must not retain only a root `db` handle when participating in the workflow.
- Source status/version update must occur conditionally in the same transaction.
- Idempotent replay behavior must return a source-consistent result after the whole workflow commits.
- Avoid nested `db.transaction()` calls; call `postInTransaction` from the application service.
- Audit entries for document, subledger, and GL must use the same request context/transaction.

## 11. Reversal Gap

### Verified behavior

- `createReversalCommand` swaps debit and credit lines.
- Original transaction remains stored and is marked `reversed`; reports include both `posted` and `reversed` originals so the opposite entry nets it.
- Reversal stores `reversalOfId` and preserves source tuple, currency, and exchange rate.
- Original lookup is company-scoped and requires `posted` status.
- Reversal goes through standard balance, account, period, idempotency, and audit handling.
- Original status update is conditional, protecting against a concurrent loser.
- Journal reversal runs creation, posting, original update, and audits in one transaction.

### Gaps

**Target requires** one reversal with explicit reason and valid period → **Current code does** use application checks/idempotency and accepts an optional memo, but has no DB unique constraint on `reversalOfId`, no mandatory reason, and inherits missing-period behavior → **Gap** direct/concurrent edge paths are not fully constrained and audit intent is weak → **Required change** add partial unique reversal enforcement, require a reason at the application boundary, and resolve exactly one open reversal period.

GL reversal owns only the opposite accounting facts and original/reversal relationship. Future feature modules must atomically reverse their business status, allocations/subledger facts, and inventory facts while calling the GL reversal port. The core must not invent those feature changes.

## 12. Idempotency & Concurrency Gap

| Protection | Current status | Enforcement |
|---|---|---|
| Same API retry, same payload | Implemented | DB claim + stored response |
| Same idempotency key, changed payload | Implemented | Request-hash comparison |
| Same source posted twice | Implemented | company/source/kind unique idempotency row plus posting fingerprint unique index |
| Concurrent posting claim | Implemented | `INSERT ... ON CONFLICT DO NOTHING` |
| Concurrent GL insert | Implemented | fingerprint unique index; conflict normalized |
| Concurrent reversal | Partial | conditional original status update and idempotency; no unique `reversal_of_id` |
| Concurrent journal numbering | Weak | random UUID fragment + company/number unique index; collision returns conflict rather than allocating next number |
| Stale processing claim recovery | Partial/UNVERIFIED | expiry is stored; recovery/cleanup behavior was not proven in core writer |

**Target requires** deterministic database-backed concurrency → **Current code does** provide strong posting/source idempotency but weak numbering/reversal constraints → **Gap** correctness is mostly protected while operational sequencing and rare races remain → **Required change** use an atomic company document sequence for journals, add reversal uniqueness, and add real concurrent PostgreSQL tests.

Changing fingerprint inputs (for example adding source version/profile version) must use a deliberate compatibility/versioning strategy; otherwise an old retry can be interpreted as a new posting.

## 13. Tenant / Branch Gap

### Verified protections

- Request company, branch, actor, and request ID come from authenticated session identity, not request body.
- Identity repository chooses an active branch belonging to the user's company.
- Account, period, original transaction, duplicate, and journal-document queries in the posting path are company-scoped.
- GL header and audit record use context company/branch/actor.

### Gaps

**Target requires** company-safe account, branch, period, source, and currency relationships → **Current code does** use single-column foreign keys and application predicates → **Gap** the database can accept a branch, period, account, or user belonging to another company if a buggy/internal writer supplies it → **Required change** introduce composite company-safe foreign keys or equivalent enforced keys after data audit.

- The writer does not validate that `context.branchId` belongs to the company; it trusts authentication. Defense-in-depth is missing.
- Generic source IDs cannot have one FK because sources span tables. Source ownership/version must be verified by the feature adapter in the same transaction.
- Currency/account mapping is not validated against the company.
- `accounts.parentId` has no FK and no company-safe hierarchy enforcement.
- Existing customer/vendor/item/tax account-ID foreign keys are not composite company-safe.

Branch-membership/authorization beyond the user's selected default active branch is **UNVERIFIED**; no user-to-many-branches authorization model was found in the inspected request-context path.

## 14. Audit Gap

**Target requires** actor, request, company, branch, source, result, timestamp, and reversal context → **Current code does** store request/company/branch/user/action/entity type/source ID/timestamp, with `changes` used on the higher-level reversal audit → **Gap** a posting audit does not record transaction ID/number, period, totals, currency/rate, fingerprint, or source version; reversal reason is optional and not reliably in the GL audit → **Required change** enrich immutable audit payloads without storing an uncontrolled copy of sensitive documents.

Recommended posting audit fields: transaction ID/number, source tuple/version, posting kind/fingerprint, fiscal period ID, transaction and functional currency, rate/provenance, debit/credit totals, profile/version, and resolved account meanings. Recommended reversal audit fields: original and reversal transaction IDs, reason, effective date, and initiating source transition.

`audit_events` supports traceability; it is not a ledger or a substitute for immutable source/subledger facts.

## 15. Database Constraint Gap

| Invariant | Classification | Evidence / required action |
|---|---|---|
| Company account number unique | Already enforced | `accounts_company_number_uq` |
| Company system meaning unique | Already enforced | partial `accounts_company_system_key_uq` |
| Account normal balance valid | Already enforced | check debit/credit |
| Account parent exists/same company | Missing | `parentId` has no FK |
| Period company/name unique | Already enforced | unique index |
| Period start <= end | Missing | add check |
| Period status valid | Missing | add check/enum |
| Company period ranges do not overlap | Missing | PostgreSQL exclusion constraint |
| Every posting has period | Application-only and defective | column nullable; writer permits none |
| Transaction status valid | Already enforced | check constraint |
| Company transaction number unique | Already enforced | unique index |
| Source post unique | Already enforced indirectly | posting fingerprint and idempotency source uniqueness; source index itself is non-unique |
| Line nonnegative/one-sided | Already enforced | checks |
| At least two lines | Application-only | `assertBalanced` |
| Whole journal balanced/non-zero | Application-only | `assertBalanced`; cross-row DB check needs deferred trigger or restricted write privilege |
| Line number unique per journal | Already enforced | unique index |
| Reversal references transaction | Already enforced | self-FK/restrict |
| One reversal per original | Missing | add partial unique index on `reversal_of_id` for reversal rows |
| Reversal same company | Application-only | repository predicate; single-column FK cannot enforce it |
| Idempotency key per company | Already enforced | unique index |
| Idempotency source tuple | Already enforced | unique index |
| Idempotency status valid | Already enforced | check |
| Header branch/period/user same company | Application-only | separate FKs; add composite company-safe references |
| Line account same company as header | Application-only | resolver checks; DB lacks company on line/composite FK |
| Currency/rate consistency | Missing | add checks and company currency relationship |
| Company posting-profile code/version unique | Missing | tables do not yet exist |
| Journal number allocation | Partial | uniqueness yes; atomic sequential allocation absent |

Cross-row balance cannot be expressed as a normal PostgreSQL `CHECK`. Prefer forcing all writes through a restricted function/service plus a deferred constraint trigger if direct DB writers must be defended against.

## 16. Test Coverage Gap

| Scenario | Current coverage | Gap / required test |
|---|---|---|
| Balanced journal | Covered in unit and API-memory integration | Add real PostgreSQL success assertion |
| Unbalanced rejection | Covered | Add DB writer integration |
| Zero journal rejection | Covered in `money.test.ts` | Keep canonical-money equivalent |
| Closed period | Covered in API-memory integration | Add PostgreSQL test |
| Missing period | Missing | Must fail in unit + PostgreSQL integration |
| Overlapping periods | Missing | Migration/constraint and resolver test |
| Tenant isolation | Generic API test exists | Add cross-company account/period/source PostgreSQL tests |
| Branch authorization | Generic RBAC/context partly covered | Add unauthorized/wrong-company branch posting test |
| Account meaning resolution | Partial invoice/system-key unit coverage | Add resolver precedence/type/inactive/missing tests |
| Control-account manual restriction | Code present; dedicated PostgreSQL proof not found | Add manual rejection and automated acceptance tests |
| Exact money/excess precision | Covered in `money.test.ts` | Add negative rounding, multiplication/division, overflow and duplicate-helper migration tests |
| Functional currency | Missing | Same-currency invariant, invalid currency/rate, frozen amounts |
| Idempotent retry | Covered in memory unit/API invoice tests | Add PostgreSQL stored-response replay |
| Key reused with changed payload | Covered in memory unit | Add PostgreSQL conflict test |
| Duplicate source | Covered in memory unit | Add PostgreSQL uniqueness test |
| Concurrent posting | Missing | Two real DB connections, one resulting journal |
| Reversal/opposite lines | Covered in API-memory integration | Add PostgreSQL line/result assertions |
| Double reversal | Covered at API-memory level | Add concurrent PostgreSQL test and constraint test |
| Atomic rollback | Missing | Force line/audit/source failure and assert no partial rows |
| Journal numbering concurrency | Missing | Parallel allocation uniqueness/sequence test |
| Audit payload | Partial | Assert actor/request/result/reason fields |

The large API integration suite calls `createApp()` with memory-backed repositories unless separately configured; it is not evidence of PostgreSQL transaction/constraint behavior. A real ephemeral PostgreSQL test harness was not found, so database behavior remains **UNVERIFIED** until added.

## 17. Dependency Map

```text
Canonical Money
  ├─ Posting validation and balance
  ├─ Profile amount bases
  ├─ FX conversion/rounding
  ├─ Reversal amounts
  └─ Accounting tests

Fiscal Period Resolver ──→ Posting Service ──→ Canonical Ledger Writer

Account Meaning Registry
  └─ AccountResolver
      ├─ company systemKey mappings
      ├─ item/customer/vendor/tax mappings
      ├─ payment instrument mappings
      └─ Posting Profiles

Company Currency Policy
  ├─ Posting Contract
  ├─ GL header/line schema
  └─ reporting/reconciliation consumers

Posting Contract + Resolver + Period + Money
  └─ Ledger Writer hardening
      ├─ idempotency/fingerprint
      ├─ numbering
      ├─ audit
      └─ PostgreSQL atomicity/concurrency tests
```

Dependency rules:

- Money precedes every calculation migration.
- Period resolution can be hardened independently and early.
- Meaning registry precedes posting profiles; profiles must not embed account numbers.
- Currency schema requires canonical money and data audit.
- DB `NOT NULL`/composite constraints follow backfill and quarantine, never precede them.
- Caller migrations follow compatibility APIs and core PostgreSQL tests.

## 18. Recommended Phase 2B–2G Sequence

### Phase 2B — Canonical money foundation

- Specify exact parser, scale types, rounding, formatting, and overflow behavior.
- Implement tests first, including negative half-away-from-zero cases.
- Adapt `ledger-math` while preserving existing posting input/output strings.
- Migrate duplicate operational/payroll/invoice helpers incrementally.
- No schema migration is required for the first step.

### Phase 2C — Fiscal periods and account resolver

- Implement exact-one open-period resolver and immediate missing/overlap failure.
- Introduce typed account-meaning registry and resolver.
- Reuse `accounts.systemKey` and existing specific mappings.
- Validate active/type/control/company policies.
- Remove automated account-number fallbacks behind a compatibility adapter.

### Phase 2D — Posting contract and profiles

- Add source version and resolved configuration metadata.
- Add minimal typed posting profile/profile-line schema.
- Add payment-instrument mapping.
- Keep feature calculations outside `writePosting`.
- Version fingerprint semantics and preserve old retry behavior.

### Phase 2E — Functional currency persistence

- Enforce same-currency/rate-one first.
- Audit and quarantine ambiguous historical FX data.
- Add/backfill functional currency and amount columns.
- Dual-write, reconcile, then make required.
- Defer broad multi-currency behavior.

### Phase 2F — Constraints, numbering, audit

- Period checks/exclusion and required transaction period.
- Composite company-safe relationships where practical.
- Unique reversal enforcement.
- Atomic company journal sequence using the established sequence pattern.
- Enrich posting/reversal audit payloads.

### Phase 2G — PostgreSQL verification and caller readiness

- Add ephemeral real-PostgreSQL integration harness.
- Test concurrency, retries, rollback, cross-company references, periods, reversals, and numbering.
- Run reconciliation queries between source, GL, and reports.
- Publish the stable transaction-scoped port for Phase 3 AR.

Each phase must keep the current canonical writer and deliver compatibility adapters rather than a flag-day rewrite.

## 19. Phase 2 Exit Criteria

Phase 2 is complete only when all of the following are true:

- One canonical exact money implementation is used by accounting-core calculations; no silent truncation remains.
- Every posting and reversal resolves to exactly one open company fiscal period.
- Period overlap and invalid period state/date ranges are prevented at DB level.
- Automated posting uses typed business meanings/resolved company account IDs, not hardcoded account numbers.
- Existing item/customer/vendor/tax mappings are reused and company-validated.
- Minimal versioned posting profiles and payment-instrument mappings exist.
- Posting contract records source version, stable fingerprint semantics, and required accounting context.
- Transaction and functional currencies/amounts are explicit and historically reproducible.
- `writePosting` remains the single canonical GL persistence path.
- Journal numbering is atomic and company-scoped.
- Idempotency, source uniqueness, and one-reversal rules are database-enforced.
- Source/subledger/GL/audit can share one `DatabaseTransaction` without nested transactions.
- Posting/reversal audits identify actor, request, source, GL result, period, totals, currency, and reason.
- Company/branch/account/period relationships cannot cross tenants through trusted internal calls.
- All core unit tests pass.
- Real PostgreSQL integration tests prove rollback and concurrent posting/reversal/numbering behavior.
- Reconciliation reports show no unexplained source-to-GL difference.

## 20. Risks / Things We Must Not Break

- Do not replace `PostgresLedgerRepository.writePosting`; harden it behind stable ports.
- Do not create a second GL writer for profiles, AR, AP, inventory, or imports.
- Do not renumber or mutate posted journals.
- Do not delete original postings during reversal; original plus linked opposite entry must remain visible.
- Do not change fingerprint inputs without retry/backward-compatibility treatment.
- Do not turn `reversed` originals invisible in financial queries; both original and reversal belong in the books.
- Do not duplicate existing item/customer/vendor/tax mappings.
- Do not introduce a generic formula/rules engine in Phase 2.
- Do not enable broad multi-currency before functional facts, rounding, and rate direction are explicit.
- Do not add `NOT NULL`, exclusion, or composite constraints before auditing/backfilling/quarantining existing data.
- Do not perform financial arithmetic with JS floating-point numbers.
- Do not silently round or truncate API inputs.
- Do not allow feature modules to open nested transactions around `post()`; pass the same transaction to `postInTransaction`.
- Do not treat audit rows as accounting facts or source of balances.
- Do not let manual journals post to control accounts merely to bypass a missing feature workflow.
- Do not start Phase 3 AR until PostgreSQL atomicity and concurrency tests pass.

## Direct Recommendation for Phase 2B

The smallest first implementation change should be a **canonical, fully tested money parser/formatter that preserves the current scale-4 string contract**, followed by making `ledger-math.ts` delegate to it without changing database schema or posting command shapes.

This is the safest starting point because it is additive, can be proven with deterministic unit tests, requires no data migration, preserves current REST and PostgreSQL representations, and removes the arithmetic ambiguity on which period, resolver, currency, profile, and ledger changes will depend. The first Phase 2B pull request should not migrate every caller at once: establish the canonical module, cover exact parsing/rounding/negative cases, adapt the ledger path, and then migrate duplicate helpers in small verified steps.
