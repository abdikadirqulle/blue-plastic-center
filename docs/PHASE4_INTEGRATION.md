# Phase 4 — React and REST API Integration

The React/Vite application now uses the live Fastify API by default.

## Client architecture

- `ApiClient` owns JSON envelopes, cookie credentials, CSRF headers, structured
  API errors, CRUD, workflow actions, Trash, and automatic expired-session
  routing.
- TanStack React Query owns server-state caching, query keys, mutations,
  invalidation, loading states, and error states.
- A protected route validates `/v1/auth/me` before rendering the workspace.
- Sales, operations, enterprise accounting, project, and payroll repositories
  use the REST API. Mock repositories remain fixture code only.

## Connected screens

- Module lists load tenant-scoped API records and apply API search/status filters.
- Detail pages fetch records by UUID and render stored fields and transaction
  lines.
- Create and edit forms submit `POST` and versioned `PATCH` requests.
- Delete actions call soft delete and invalidate both module and Trash caches.
- Journal posting, fulfillment, bank-feed add, payroll approval, sales
  conversion, and supported financial reports call secured workflow endpoints.

## Trash and recovery

`/trash` is available to roles with delete permission. It supports search,
module filtering, pagination-ready API envelopes, and restore. Restore clears
`is_deleted` and `deleted_at`, increments the record version, writes an audit
event, and invalidates the original module cache.

The API never exposes a permanent-delete operation.

