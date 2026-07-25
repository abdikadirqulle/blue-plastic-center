# Frontend Architecture

## Stack

- Next.js, React, and TypeScript
- Tailwind CSS
- Lucide icons
- Recharts for dashboard visualization
- React Hook Form and Zod for forms and validation
- `date-fns` for date presentation
- `clsx`, `tailwind-merge`, and class variance utilities

## Directory structure

```text
app/                 Routes, layouts, and route metadata
components/
  layout/            Application shell and navigation
  ui/                Reusable low-level components
features/            Product modules and module-specific components
lib/                 Utilities, formatters, constants, and data adapters
types/               Shared domain and API types
docs/                Product and engineering decisions
tests/               Automated validation
```

## Navigation

- Overview
- Sales
- Expenses & Purchasing
- Banking
- Items & Inventory
- Accounting
- Projects
- Payroll
- Reports
- Settings

## Frontend principles

- Server components by default; add client components only for interaction.
- Screens consume typed service interfaces, never raw storage.
- Filters and table state should be URL-addressable when practical.
- All money is displayed with an explicit currency.
- Tables require loading, empty, error, pagination, and narrow-screen behavior.
- Forms must protect unsaved work and show field-level validation.
- Destructive actions require clear scope and confirmation.
- Every screen must consider role permissions and company context.

## Design tokens

- Ink/navy for primary text and navigation.
- Al-Furat blue `#007DCC` for primary actions, links, selected navigation, and charts.
- Green is reserved for successful financial status.
- Amber for pending attention.
- Red for overdue, destructive, or failed states.
- Neutral surfaces with restrained borders and shadows.
