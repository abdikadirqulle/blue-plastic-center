# System Architecture

## Delivery approach

Use a Turborepo monorepo with a modular-monolith backend. Maintain clean module boundaries so high-volume or
integration-heavy workloads can be extracted later without premature distributed
systems complexity.

```text
apps/web       React and Vite frontend
apps/api       Backend workspace
packages/types Shared domain contracts
packages/config Shared TypeScript configuration
```

## Application layers

```text
Web client
  -> application API
    -> domain modules
      -> accounting posting engine
      -> PostgreSQL
    -> background job queue
    -> object storage
    -> external integrations
```

## Backend

- Hono REST API with TypeScript
- PostgreSQL
- Drizzle ORM
- Zod request and domain validation
- Repository interfaces with PostgreSQL and in-memory test adapters
- Bearer authentication, role-based access control, tenant and branch context
- Optimistic locking, soft deletion, and immutable audit events
- Redis-backed jobs and S3-compatible object storage remain planned for asynchronous imports, report generation, and attachments

## Module boundaries

Identity, organizations, general ledger, sales, purchasing, inventory, banking,
projects, fixed assets, payroll, reporting, workflows, integrations, and audit.

All modules may request ledger postings through the accounting engine. They must
not write journal lines directly.

## Backend directory structure

```text
apps/api/
  src/
    app.ts                         HTTP routes, middleware, error envelope
    index.ts                       Node server and repository selection
    db/
      client.ts                    PostgreSQL/Drizzle connection
      schema.ts                    Tenant, ledger, resource, and audit tables
      seed.ts                      Initial company, branch, and demo users
    domain/
      modules.ts                   Module/resource registry and required fields
    platform/
      auth.ts                      Authentication and RBAC grants
      errors.ts                    Stable API error codes
      types.ts                     Context, records, pagination, and audit types
    repositories/
      resource-repository.ts       Persistence contract
      memory-resource-repository.ts
      postgres-resource-repository.ts
    services/
      resource-service.ts          Validation, CRUD, posting, locking, and audit
  drizzle/                         Versioned PostgreSQL migrations
  tests/                           End-to-end API contract tests
```

## Accounting invariants

- Every request is scoped by company and branch.
- Monetary values cross API boundaries as strings, never floating-point domain values.
- Journal entries require at least two lines and equal debit and credit totals.
- Posted records cannot be deleted; corrections use reversal/adjustment workflows.
- Updates use a `version` field to prevent lost writes.
- Deletes are soft deletes and generate audit events.
- Every create, update, delete, and post operation records actor, request, company, branch, entity, and timestamp.
