# Backend Architecture

## Stack

- Node.js 22 and TypeScript
- Fastify 5 REST API
- PostgreSQL with Drizzle ORM and Drizzle Kit migrations
- Zod environment, request, and domain validation
- `postgres` driver with prepared statements disabled for transaction poolers
- Node test runner with Fastify injection

The React application is a separate client. It communicates with this backend
through versioned JSON endpoints under `/v1`; frontend components never import
database or server code.

## Directory structure

```text
apps/api/
  src/
    config/                 Validated runtime configuration
    db/                     Drizzle connection, schema, and seed
    domain/                 Backend domain definitions
    modules/
      imports/              Bulk import endpoints
      reports/              Report execution endpoints
      resources/            Shared CRUD routes and schemas
      system/               Metadata and audit endpoints
      auth/                 Phase 1 authentication
      sales/                Phase 2 sales
      purchasing/           Phase 2 procure-to-pay
      inventory/            Phase 2 inventory
      banking/              Phase 2 banking
      accounting/           Phase 3 ledger
      projects/             Phase 3 project costing
      payroll/              Phase 3 payroll
    platform/               Authorization, errors, and request types
    plugins/                Fastify lifecycle and infrastructure
    repositories/           Persistence contracts and adapters
    services/               Application workflows
    types/                  TypeScript module augmentation
    app.ts                  Fastify composition root
    index.ts                Process entry and graceful shutdown
  drizzle/                  Committed SQL migrations
  tests/                    Black-box REST API tests
```

Empty future module directories are documented rather than committed. A module
is added when its first route, service, schema, or repository exists.

## Request lifecycle

1. Fastify assigns a request ID and applies security/CORS rules.
2. Request context resolves company, branch, user, and role.
3. The route parses input with Zod and checks permission.
4. A service applies business and accounting rules.
5. A repository performs tenant-scoped persistence through Drizzle.
6. Mutations append an audit event.
7. The API returns the standard data or error envelope.

## Database rules

- Use PostgreSQL `numeric`, represented as strings at API boundaries, for money.
- Never use JavaScript floating-point arithmetic for posted financial amounts.
- Operational rows are company-scoped; applicable rows are also branch-scoped.
- Posted entries are immutable; corrections use reversals or adjustments.
- Multi-table mutations use one database transaction.
- Optimistic versions prevent silent overwrites.
- Operational deletion is soft deletion.
- Schema changes use reviewed, committed Drizzle migrations.

## Setup and commands

```bash
cp apps/api/.env.example apps/api/.env
npm install
npm run dev:api
```

Production requires `DATABASE_URL`, `WEB_ORIGIN`, and `NODE_ENV=production`.

```bash
npm run typecheck -w @blue-plastic/api
npm run test -w @blue-plastic/api
npm run build -w @blue-plastic/api

npm run db:generate -w @blue-plastic/api
npm run db:migrate -w @blue-plastic/api
npm run db:seed -w @blue-plastic/api
npm run db:studio -w @blue-plastic/api
```

Migration workflow:

1. Update `src/db/schema.ts`.
2. Run `db:generate` and review the SQL.
3. Apply it locally with `db:migrate`.
4. Run typecheck, tests, and build.

## Current production boundary

The generic service and in-memory repository support frontend integration and
tests. PostgreSQL is selected whenever `DATABASE_URL` exists.

Demo bearer tokens are development scaffolding only. Phase 1 replaces them with
database users, password hashing, secure sessions, login throttling, and role
assignments before real company data is stored.
