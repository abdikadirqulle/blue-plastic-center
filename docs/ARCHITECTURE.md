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

- Fastify REST API with TypeScript
- PostgreSQL
- Drizzle ORM
- Zod request and domain validation
- Repository interfaces with PostgreSQL and in-memory test adapters
- Cookie-session authentication, CSRF protection, role-based access control,
  and database-derived company and branch context
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
    app.ts                         Fastify composition root
    index.ts                       Node process and graceful shutdown
    config/
      env.ts                       Zod-validated runtime configuration
    db/
      client.ts                    PostgreSQL/Drizzle connection
      schema.ts                    Tenant, dedicated module, ledger, and audit tables
      seed.ts                      Initial company, branch, and demo users
    domain/
      modules.ts                   Module/resource registry and required fields
    modules/
      system/                      Metadata and audit routes
      resources/                   Transitional CRUD adapter for unmigrated modules
      reports/                     Report execution
      imports/                     Import validation
    plugins/
      request-context.ts           Authentication and request scope
      error-handler.ts             Stable API error envelope
    platform/
      auth.ts                      Authentication and RBAC grants
      errors.ts                    Stable API error codes
      types.ts                     Context, records, pagination, and audit types
    repositories/
      resource-repository.ts       Transitional persistence contract
      memory-resource-repository.ts
      postgres-resource-repository.ts
    services/
      resource-service.ts          Validation, CRUD, posting, locking, and audit
    types/
      fastify.d.ts                  Fastify request augmentation
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

## Relational persistence decision

Core business records use dedicated tables with typed columns and foreign keys.
The former `resource_records` JSONB table is retained only during the
expand-and-contract migration documented in `RELATIONAL-MIGRATION.md`. A module
is not considered production-ready while its primary records still use that
transition table.
