# Frontend Architecture

## Stack

- Next.js, React, and TypeScript
- Tailwind CSS
- Lucide icons
- React Hook Form and Zod for forms and validation
- Radix-powered Shadcn-style select and popover controls
- React DayPicker for calendar date selection
- `date-fns` for date presentation
- `clsx`, `tailwind-merge`, and class variance utilities

## Directory structure

```text
app/                 Routes, layouts, and route metadata
components/
  layout/            Application shell and navigation
  ui/                Reusable low-level components
features/
  dashboard/         Overview widgets and activity feeds
  resources/         Typed module registry, tables, forms, and CRUD interactions
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

Every operational workspace remains separate in the main navigation: Sales,
Purchasing, Banking, Items & Inventory, Accounting, Projects, Payroll, Reports,
Import Data, and Settings.

Every operational resource has a dedicated nested route. For example, Sales uses
`/sales/invoices`, `/sales/customers`, `/sales/estimates`,
`/sales/sales-orders`, `/sales/payments`, and `/sales/credit-notes`.
Purchasing, banking, inventory, accounting, projects, payroll, reports, and
settings follow the same `/:section/:resource` convention.

## Resource screens

- Each resource owns its title, statistics, table columns, sample records,
  statuses, and complete field groups through a typed configuration.
- Transaction forms include document headers, customer or vendor details,
  billing and shipping information, accounting classifications, tax and
  payment settings, notes, and editable line items where applicable.
- Search, status filtering, reset, CSV export, pagination controls, view,
  edit, create, delete, and save actions are interactive in the frontend.
- Create and edit actions open full pages at `/:section/:resource/new`; forms
  provide both **Save & new** and **Save & close** workflows.
- User-facing dates use the shared calendar popover; enumerated values use the
  shared dropdown component instead of native browser date/select controls.
- Zod validates required values and formats before transaction, settings, and
  authentication forms can submit.
- Frontend changes are session-local until the API and database layer is
  connected.

## Purpose-built workspaces

- Reports use a non-table report center with category tabs, QuickBooks-style
  report catalogues, period presets, From/To date pickers, accounting basis,
  favorites, run, and export actions.
- Settings use a non-table section navigation with grouped preference forms
  for company, branches, users and roles, currencies, taxes, and workflows.
- Import Data provides module selection, CSV/Excel upload, column mapping
  workflow steps, templates, and validation guidance.

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
