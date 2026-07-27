# Remaining Delivery Phases

The core backend domain phases are complete. The following work connects the
React application and prepares the system for real company use.

## Phase 4 — Frontend and API integration

- Shared authenticated API client with cookies and CSRF headers
- React Query query keys, caching, mutations, invalidation, and error mapping
- Replace module mock repositories with REST services
- Connect create, edit, detail, soft-delete, workflow, filter, pagination, and
  report screens
- Loading, empty, stale-version, permission, and server-error states
- End-to-end tests for the highest-risk accounting workflows

## Phase 5 — Files and background workers

- Object storage adapter for attachments
- PDF invoice/report generation worker
- Email delivery worker with retry and delivery history
- Scheduled recurring invoices, journals, and report jobs
- Job idempotency, dead-letter handling, and operator visibility

## Phase 6 — Production readiness

- Production secrets and allowed-origin configuration
- Structured logs, metrics, alerts, and error monitoring
- Automated backups, retention policy, and verified restore rehearsal
- Live PostgreSQL integration tests and accounting fixture reconciliation
- Security review, dependency audit, rate-limit tuning, and session review
- Accountant approval for the chart of accounts, tax setup, opening balances,
  close procedure, and financial reports

