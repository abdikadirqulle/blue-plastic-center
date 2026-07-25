# System Architecture

## Delivery approach

Use a Turborepo monorepo with a modular-monolith backend. Maintain clean module boundaries so high-volume or
integration-heavy workloads can be extracted later without premature distributed
systems complexity.

```text
apps/web       Next.js frontend
apps/api       Backend workspace
packages/types Shared domain contracts
packages/config Shared TypeScript configuration
```

## Planned application layers

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

## Planned backend

- NestJS with TypeScript
- PostgreSQL
- Drizzle ORM
- Redis and BullMQ
- S3-compatible object storage
- OpenAPI-documented REST endpoints

## Module boundaries

Identity, organizations, general ledger, sales, purchasing, inventory, banking,
projects, fixed assets, payroll, reporting, workflows, integrations, and audit.

All modules may request ledger postings through the accounting engine. They must
not write journal lines directly.
