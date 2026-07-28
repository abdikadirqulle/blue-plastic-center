# Testing

BLUE PLASTIC CENTER uses Vitest as the test runner for the full monorepo.
The root configuration uses Vitest projects so each layer has an explicit
environment and purpose.

## Test projects

| Project | Location | Environment | Purpose |
| --- | --- | --- | --- |
| `api-unit` | `apps/api/tests/unit` | Node | Domain arithmetic, security helpers, services, repositories, and module contracts |
| `api-integration` | `apps/api/tests/integration` | Node | Fastify routes, authentication, authorization, CRUD, workflows, reports, imports, and tenant boundaries |
| `web-unit` | `apps/web/tests` | jsdom | React components, accessibility, routing, and frontend service boundaries |
| `shared-contracts` | `packages/types/tests` | Node | Shared Zod contracts and form/API types used by frontend and backend |

API integration tests use Fastify `inject`, so they exercise the complete HTTP
request lifecycle without opening a network port. The default application uses
in-memory repositories to keep tests deterministic and isolated from production
PostgreSQL.

## Commands

Run every test once:

```bash
npm test
```

Run only fast unit and component tests:

```bash
npm run test:unit
```

Run the API integration suite:

```bash
npm run test:integration
```

Watch tests during development:

```bash
npm run test:watch
```

Generate text, HTML, and LCOV coverage reports:

```bash
npm run test:coverage
```

The HTML report is written to `coverage/index.html`. Coverage must remain at or
above 80% for statements, functions, and lines, and 70% for branches.

## Conventions

- Name unit tests `*.test.ts` or `*.test.tsx` under a `tests/unit` directory.
- Name API route/workflow tests `*.integration.test.ts` under
  `tests/integration`.
- Keep each test independent and create a fresh app or repository per test.
- Test financial calculations with decimal strings and exact expected values.
- Cover success, validation, authorization, conflict, and tenant-isolation
  paths for new API endpoints.
- Add every new operational resource to the shared contract registry test.
- Never connect automated tests to the production database.

Before handing off a change, run:

```bash
npm run check
npm run test:coverage
npm run build
```
