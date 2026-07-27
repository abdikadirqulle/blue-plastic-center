# BLUE PLASTIC CENTER

BLUE PLASTIC CENTER is a Turborepo-based web accounting and business operations platform
being built with the functional breadth of enterprise accounting software.

## Current features

- Turborepo monorepo with separate web, API, and shared packages
- Responsive enterprise application shell
- Company context and main module navigation
- Executive financial dashboard
- Cash-flow chart, receivables health, activity, and inventory alerts
- Login, sales, purchasing, banking, inventory, accounting, projects, payroll,
  reports, and settings pages
- Working search, filters, forms, record details, editing, exports, and menus
- Responsive top navigation and a dedicated QuickBooks-style Sales Center
- Cash sales, refunds, statements, deposits, recurring invoices, allocations,
  transaction conversions, document preview, print, and invoice PDF download
- Swappable mock/API sales repositories with service and query-state boundaries
- Phase 2 procure-to-pay, advanced inventory/fulfillment, bank feeds, rules, and
  full account reconciliation workspaces
- Swappable mock/API operations repository for purchasing, inventory, and banking
- Typed API client boundaries and realistic frontend mock data
- Multi-tenant Hono REST API with Zod validation and RBAC
- PostgreSQL/Drizzle schema, migrations, seed data, audit events, and optimistic locking
- Product, architecture, frontend, roadmap, and accounting documentation

## Technology

- Next.js 16, React 19, and TypeScript
- Tailwind CSS 4
- Lucide React icons
- React Hook Form and Zod
- Hono, PostgreSQL, and Drizzle ORM
- Vinext/Vite development and deployment runtime

## Local development

Requirements:

- Node.js 22.13 or newer
- npm

Install and run:

```bash
npm install
npm run dev
```

The development server prints the local URL in the terminal.

Run the API separately:

```bash
cp apps/api/.env.example apps/api/.env
npm run db:migrate -w @blue-plastic/api
npm run db:seed -w @blue-plastic/api
npm run dev:api
```

The API runs at `http://localhost:4000`. Development bearer tokens and complete
endpoint documentation are in `docs/API.md`.

## Validation

```bash
npm run build
npm run lint
npm test
```

## Project map

```text
apps/web/             Next.js frontend
apps/api/             Backend workspace
packages/types/       Shared domain contracts
packages/config/      Shared configuration
docs/                 Product and engineering documentation
```

Read `AGENTS.md` before making changes. Product scope and delivery decisions are
recorded in `docs/`.
