# Accounting Documentation

Start here for all accounting work. This index identifies the current contracts,
the stabilized core, and the boundaries of future work.

## Documentation hierarchy

Current authoritative contracts, in order:

1. [`ACCOUNTING-TARGET-ARCHITECTURE.md`](./ACCOUNTING-TARGET-ARCHITECTURE.md) — accounting boundaries, invariants, and target domain architecture.
2. [`ACCOUNTING-RULES.md`](./ACCOUNTING-RULES.md) — non-negotiable financial rules.
3. [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system-wide module and persistence boundaries.
4. [`RELATIONAL-MIGRATION.md`](./RELATIONAL-MIGRATION.md) — expand-and-contract path away from transitional storage.
5. [`REPORTING-READ-MODEL-DESIGN.md`](./REPORTING-READ-MODEL-DESIGN.md) — authoritative reporting sources and reconciliation rules.
6. [`NEXT_PHASES.md`](./NEXT_PHASES.md) — current delivery order and next priority.

Historical audits and implementation plans describe the system at a point in
time and must not override current architecture contracts. They are retained in
[`archive/accounting/`](./archive/accounting/) for implementation history only.

## Current state

### Accounting Core — STABLE

The completed foundation includes:

- canonical exact Money;
- canonical Posting Engine and PostgreSQL GL writer;
- mandatory exact-one OPEN fiscal-period resolution;
- typed account meanings and centralized `AccountResolver`;
- deterministic posting-profile foundation;
- explicit transaction and functional currency amounts;
- idempotent, source-unique posting;
- immutable linked reversals and DB-backed double-reversal protection;
- caller-owned atomic PostgreSQL transaction support;
- PostgreSQL posting/reversal concurrency verification; and
- company and tenant account isolation.

**Accounting Core stabilization is complete.** This does not mean the whole
accounting product is complete.

## Work still unfinished

- AR / Sales subledger integration;
- AP / Purchasing subledger integration;
- inventory quantity/value reconciliation;
- banking operational integration;
- reporting read models and reconciliation;
- remaining relational migration away from transitional `resource_records`;
- frontend and QuickBooks-style workflow stabilization.

Foreign-currency conversion and FX accounting are intentionally deferred.
Foreign-currency GL posting currently fails safely instead of guessing a rate
direction or conversion. Posting-profile callers will be adopted within each
relevant domain stabilization phase, not through a broad standalone migration.

Projects and Payroll are intentionally deferred product modules. Existing
code, schema, and contracts may remain, but they must not be expanded or treated
as current stabilization priorities unless explicitly requested.

## Rules for Coding Agents

- Read this file first for accounting work.
- Follow current authoritative documents over archived plans.
- Do not create an alternative posting path or write journal lines from feature modules.
- Do not bypass Money, `FiscalPeriodResolver`, `AccountResolver`, or the canonical Posting Engine.
- Do not assume `resource_records` is the target architecture.
- Do not implement deferred Projects or Payroll work without explicit scope.
- Do not silently enable FX posting.
- Prefer the smallest safe change and preserve all accounting invariants.
