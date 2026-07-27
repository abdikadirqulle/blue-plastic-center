# Frontend Architecture

## Stack

- React, Vite, React Router, and TypeScript
- Tailwind CSS
- Lucide icons
- React Hook Form and Zod for forms and validation
- Radix-powered Shadcn-style select and popover controls
- React DayPicker for calendar date selection
- `date-fns` for date presentation
- `clsx`, `tailwind-merge`, and class variance utilities

## Directory structure

```text
src/                 Browser entry point, route tree, and global styles
components/
  layout/            Application shell and navigation
  ui/                Reusable low-level components
features/
  dashboard/         Overview widgets and activity feeds
  sales/
    domain/           Sales entities and repository contracts
    data/             Mock and REST repository adapters
    services/         Workflow-oriented sales use cases
    hooks/            Loading, error, query, and mutation state
    components/       Sales centers, transaction views, and PDF preview
  resources/         Typed module registry, tables, forms, and CRUD interactions
lib/                 Utilities, formatters, constants, and data adapters
types/               Shared domain and API types
docs/                Product and engineering decisions
tests/               Automated validation
```

## Navigation

- Responsive top navigation with module dropdowns
- Dashboard
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
`/sales/sales-orders`, `/sales/payments`, `/sales/credit-notes`,
`/sales/sales-receipts`, `/sales/refund-receipts`, `/sales/statements`,
`/sales/deposits`, and `/sales/recurring-invoices`.
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
- Operational tables expose module-specific primary columns and filters for
  status, the primary related entity, and From/To dates.
- Export and Print actions live beside the filters and operate on the currently
  filtered records.
- Every table row opens a complete record-details route with grouped form data,
  transaction lines where relevant, audit activity, and print, export, edit,
  copy, email, attachment, and delete actions.
- Create and edit actions open full pages at `/:section/:resource/new`; forms
  provide both **Save & new** and **Save & close** workflows.
- User-facing dates use the shared calendar popover; enumerated values use the
  shared dropdown component instead of native browser date/select controls.
- The calendar uses a single compact month header, balanced navigation,
  consistent seven-column spacing, and clear today/selected states.
- Zod validates required values and formats before transaction, settings, and
  authentication forms can submit.
- Shared toasts use semantic success, error, warning, and information variants
  with matching colors, icons, descriptions, dismiss controls, and live-region
  announcements.
- Sales screens consume a `SalesRepository` contract through `salesService`.
  `MockSalesRepository` is the default; set `VITE_DATA_SOURCE=api` to use
  `ApiSalesRepository` without changing page components.
- Query hooks own loading, error, filter, refresh, and mutation state. Storage
  and HTTP concerns never enter UI components.
- Purchasing, inventory, and banking screens use the shared
  `OperationsRepository` contract through `operationsService`. The mock and API
  adapters implement the same list, detail, create, update, and delete contract,
  so connecting the backend requires changing `VITE_DATA_SOURCE`, not
  rewriting pages.
- Invoice-style documents include an on-screen preview plus working PDF
  download, print, and email-queue actions.
- Estimate and sales-order details can create draft invoices. Credit memos can
  start refund receipts, payments expose invoice allocation, and deposits expose
  undeposited-payment selection.

## Purpose-built workspaces

- Reports use a non-table report center with category tabs, QuickBooks-style
  report catalogues, period presets, From/To date pickers, accounting basis,
  favorites, run, and export actions.
- Settings use a non-table section navigation with grouped preference forms
  for company, branches, users and roles, currencies, taxes, and workflows.
- Import Data provides module selection, CSV/Excel upload, column mapping
  workflow steps, templates, and validation guidance.
- Purchasing provides a vendor center, bills and partial bill payment,
  purchase-order to partial receipt to bill workflows, vendor credits, checks,
  expenses, and a card-based approval queue with decision history.
- Inventory provides warehouse and bin-aware stock, quantity/value adjustments,
  cycle counts, assemblies and BOMs, lots, serials and expiry, landed costs,
  reorder suggestions, and a pick-pack-ship fulfillment board with backorders.
- Banking provides connected account feeds with match, add, exclude and rules,
  deposits, transfers, checks, registers, cash forecasts, and a dedicated
  reconciliation workspace with cleared transactions and a live difference.
- Accounting provides a hierarchical account center, balanced journals,
  registers, recurring entries, fiscal periods, a month-end close checklist,
  budgets and forecasts, fixed-asset depreciation, class tracking, and an
  immutable audit timeline.
- Projects provides job-cost centers, tasks, time, committed and actual costs,
  progress billing, contract change orders, and project profitability.
- Payroll provides employee profiles, timesheets, leave and loans, pay-run
  review and approval, benefit plans, payroll liabilities, and payroll reports.
- Accounting, project, and payroll pages consume `EnterpriseRepository` through
  `enterpriseService`, with mock and API adapters selected through the same
  `VITE_DATA_SOURCE` configuration used by other frontend domains.

## Frontend principles

- Components remain presentation-focused; routing and data access stay in their
  dedicated boundaries.
- Screens consume typed service interfaces, never raw storage.
- Filters and table state should be URL-addressable when practical.
- All money is displayed with an explicit currency.
- Tables require loading, empty, error, pagination, and narrow-screen behavior.
- Forms must protect unsaved work and show field-level validation.
- Destructive actions require clear scope and confirmation.
- Every screen must consider role permissions and company context.

## Design tokens

- Ink/navy for primary text and navigation.
- BLUE PLASTIC CENTER blue `#007DCC` for primary actions, links, selected navigation, and charts.
- Green is reserved for successful financial status.
- Amber for pending attention.
- Red for overdue, destructive, or failed states.
- Neutral surfaces with restrained borders and shadows.
