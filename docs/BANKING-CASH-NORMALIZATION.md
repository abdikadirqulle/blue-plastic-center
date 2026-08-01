# Banking and Cash Normalization Design

## Status and audit result

Banking is not relationally production-ready yet. The current REST resources for
accounts, bank feeds, deposits, transfers, checks, rules, and reconciliations are
stored through the transitional `resource_records` JSONB adapter. The existing
workflow routes only change resource status; they do not own normalized bank
transactions, immutable statement lines, clearing links, reconciliation locks,
or ledger posting references.

The first domain-safe component is
`modules/banking/bank-transfer-posting.ts`. It maps an approved same-currency,
same-company, same-branch transfer to the centralized accounting posting command
using fixed-point scale-4 arithmetic:

```text
Dr destination bank/cash/credit-card ledger     transfer amount
Dr bank-fee expense ledger                      explicit fee only
    Cr source bank/cash/credit-card ledger      amount + explicit fee
```

A transfer never posts revenue or expense. The only P&L effect permitted by the
mapper is an explicitly supplied bank fee mapped to an active expense account.
Cross-currency and inter-branch transfers are rejected until the FX and
due-to/due-from workflows below are implemented.

## Required relational tables

These tables are the exact next expand-phase persistence target. Every table
must include `company_id`; mutable tables also require `version`, audit columns,
and nullable `deleted_at`/`deleted_by`. Financial event tables are immutable and
use reversal/status records rather than deletion.

1. `bank_accounts`
   - `id`, `company_id`, nullable `branch_id`, `ledger_account_id`
   - `account_number_masked`, `name`, `kind` (`bank`, `cash`, `credit_card`,
     `mobile_money`), `currency`, `opening_balance`, `opening_balance_date`
   - `institution_name`, `active`, `allows_overdraft`, `version`, audit/soft-delete
   - unique active `(company_id, ledger_account_id)` and `(company_id, name)`
2. `bank_transfers`
   - `id`, `company_id`, `branch_id`, `document_number`, `transfer_date`
   - `from_bank_account_id`, `to_bank_account_id`, `currency`, `amount`
   - nullable `fee_amount`, `fee_expense_account_id`, `memo`
   - `status` (`draft`, `approved`, `posted`, `reversed`, `voided`)
   - nullable `posted_transaction_id`, `reversal_transaction_id`
   - `posting_idempotency_key`, `version`, audit/soft-delete while draft only
   - unique `(company_id, document_number)` and posting idempotency key
3. `bank_transactions`
   - immutable normalized cash subledger event
   - `id`, `company_id`, `branch_id`, `bank_account_id`, `transaction_date`
   - `kind`, signed `amount`, `currency`, `running_balance`, `description`
   - `source_type`, `source_id`, nullable `accounting_transaction_id`
   - nullable `reversal_of_id`, `posting_fingerprint`, audit columns
   - unique source identity and reversal identity constraints
4. `bank_statement_imports`
   - `id`, `company_id`, `bank_account_id`, file/checksum/provider metadata,
     imported range, status, counts, audit columns
5. `bank_statement_lines`
   - immutable `id`, import/account/company, external ID, posted/value dates,
     signed amount, currency, payee/reference/description, source checksum
   - `match_status` (`unmatched`, `matched`, `excluded`) and version
   - unique provider identity and content-hash safeguards
6. `bank_transaction_matches`
   - `id`, `company_id`, `statement_line_id`, `bank_transaction_id`
   - allocated amount, match method/confidence, actor/timestamp
   - allocation sum cannot exceed either side; unmatched amount is derived
7. `bank_deposits`
   - `id`, tenant/branch/document/date, destination bank account, currency,
     status, total, posting reference, idempotency, audit/version
8. `bank_deposit_lines`
   - deposit/payment link, amount applied, currency; unique payment allocation
   - deposit total must equal immutable line sum before posting
9. `bank_reconciliations`
   - account/company, statement start/end dates, beginning/ending balances,
     calculated cleared balance/difference, status, completed actor/time, version
   - one non-voided reconciliation per account and statement end date
10. `bank_reconciliation_lines`
    - reconciliation ID, bank transaction ID, cleared amount/date
    - unique transaction per finalized reconciliation; immutable after finish
11. `bank_rules` and `bank_rule_conditions`
    - tenant/account scope, priority, enabled status, typed conditions, target
      ledger/payee action, version and audit history
12. `bank_checks`
    - tenant/account/payee/document/date/amount/currency/status, printed/voided
      metadata, posting and reversal references
13. `interbranch_transfer_clearing`
    - source/destination branch, due-to/due-from accounts and paired posting IDs
14. `foreign_currency_transfer_legs`
    - transfer ID, source/destination currency amounts, rates, functional values,
      realized FX account and posting line references

All money columns use `numeric(..., 4)` or integer minor units. JavaScript
`number` is forbidden for validation, totals, allocation, or posting.

## Service boundaries and atomic workflows

- `BankAccountRepository`: tenant-scoped master-data lookup and optimistic update.
- `BankTransferRepository`: locks a draft transfer and its bank accounts, persists
  status and returned posting reference in the same database transaction.
- `BankTransferService.post`: authorizes, locks, maps through
  `mapBankTransferPosting`, calls `LedgerRepository.post`, appends both bank
  subledger legs, and marks the transfer posted atomically. Repeated calls use the
  same idempotency key and return the original result.
- `BankDepositService.post`: locks unapplied customer payments, validates their
  currencies and allocation sums, creates the bank event and ledger posting, then
  marks allocations deposited atomically.
- `StatementImportService`: checksum/idempotency validation and immutable line
  ingestion; it never posts automatically.
- `BankMatchingService`: explicit match/add/exclude commands with allocation
  locks, not status-only JSON transitions.
- `ReconciliationService.finish`: locks the account, statement lines, bank
  events, and reconciliation; recomputes the difference server-side and rejects
  any value other than exact zero. Finalized reconciliations are immutable.
- `BankTransferService.reverse`: creates both a ledger reversal and opposite
  bank subledger events; it never edits or deletes the posted transfer.

## Exact REST route contract to add

```text
GET    /api/v1/banking/accounts
POST   /api/v1/banking/accounts
GET    /api/v1/banking/accounts/:id
PATCH  /api/v1/banking/accounts/:id
DELETE /api/v1/banking/accounts/:id                 draft/unused soft delete only

GET    /api/v1/banking/transfers
POST   /api/v1/banking/transfers                    create draft
GET    /api/v1/banking/transfers/:id
PATCH  /api/v1/banking/transfers/:id                draft only + version
POST   /api/v1/banking/transfers/:id/approve
POST   /api/v1/banking/transfers/:id/post            Idempotency-Key required
POST   /api/v1/banking/transfers/:id/reverse

GET    /api/v1/banking/deposits
POST   /api/v1/banking/deposits
GET    /api/v1/banking/deposits/:id
PATCH  /api/v1/banking/deposits/:id                 draft only + version
POST   /api/v1/banking/deposits/:id/post             Idempotency-Key required
POST   /api/v1/banking/deposits/:id/reverse

POST   /api/v1/banking/accounts/:id/statements/imports
GET    /api/v1/banking/accounts/:id/statements/lines
POST   /api/v1/banking/statement-lines/:id/matches
DELETE /api/v1/banking/statement-lines/:id/matches/:matchId
POST   /api/v1/banking/statement-lines/:id/exclude

GET    /api/v1/banking/reconciliations
POST   /api/v1/banking/reconciliations
GET    /api/v1/banking/reconciliations/:id
PATCH  /api/v1/banking/reconciliations/:id          open only + version
POST   /api/v1/banking/reconciliations/:id/finish
POST   /api/v1/banking/reconciliations/:id/reopen    privileged + audited
```

List routes require cursor pagination and account/date/status filters. Every
write requires authenticated company/branch context, authorization, a stable
request ID, and an audit event.

## Required verification before cutover

Unit tests:

1. exact scale-4 transfer and fee addition, including values beyond safe integer
2. balanced destination debit/source credit mapping
3. no revenue/expense line without explicit bank fee
4. same account and duplicate ledger mapping rejection
5. cross-company, branch, and currency rejection
6. inactive/misclassified account and insufficient-balance rejection
7. fee account tenant/type/active validation
8. inter-branch and cross-currency rejection until their workflows exist

Repository/integration tests:

1. concurrent post requests create one transfer, two bank events, and one ledger posting
2. same idempotency key/same payload returns the original result; changed payload conflicts
3. all failures roll back transfer, bank events, and ledger posting together
4. closed-period, permission, tenant, branch, and stale-version failures
5. posted transfer update/delete blocked; reversal leaves the original immutable
6. deposit allocation conservation and duplicate-payment rejection
7. duplicate statement file/line idempotency and split-match allocation conservation
8. reconciliation recomputation, exact-zero finish, immutable completion, audited reopen
9. account cash-subledger balance reconciles exactly to its GL control account

Migration verification:

1. inventory every legacy banking JSON record and quarantine malformed rows
2. backfill accounts before documents; resolve every ledger/customer/payment FK
3. compare counts, document totals, account balances, and posting references
4. dual-read comparison emits zero mismatches for an agreed observation window
5. switch writes to relational repositories, then remove JSON fallback only after sign-off

