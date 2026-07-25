# Al-Furat System

Al-Furat is a Turborepo-based web accounting and business operations platform
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
- Typed mock data boundaries
- Product, architecture, frontend, roadmap, and accounting documentation

## Technology

- Next.js 16, React 19, and TypeScript
- Tailwind CSS 4
- Lucide React icons
- React Hook Form and Zod
- Drizzle ORM (prepared for the future data layer)
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
