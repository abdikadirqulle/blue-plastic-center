# Al-Furat System — Product Requirements

## Vision

Build a secure web accounting and business operations platform with functional
coverage comparable to QuickBooks Enterprise, adapted for organizations that
need branches, warehouses, projects, multiple currencies, and regional payment
workflows.

## Product goals

- Provide one reliable financial source of truth.
- Make sales, purchasing, inventory, banking, projects, payroll, and reporting
  operate on the same accounting foundation.
- Support multiple companies without mixing books or permissions.
- Preserve a complete, reviewable audit trail.
- Make daily workflows fast enough for high-volume operators.

## Primary users

- Company owner / executive
- Finance manager
- Accountant
- Accounts receivable clerk
- Accounts payable clerk
- Sales representative
- Purchasing officer
- Warehouse manager
- Payroll / HR officer
- Auditor

## Functional scope

### Foundation

Company profiles, fiscal years, accounting periods, branches, departments,
currencies, exchange rates, taxes, document sequences, opening balances,
attachments, imports, exports, and period locks.

### General ledger

Chart of accounts, account registers, balanced journals, recurring and adjusting
journals, reversals, accruals, allocations, trial balance, general ledger,
profit and loss, balance sheet, cash flow, and retained earnings.

### Sales and receivables

Customers, estimates, sales orders, deliveries, invoices, recurring invoices,
sales receipts, credit notes, deposits, payments, statements, credit limits,
commissions, pricing, aging, and returns.

### Purchasing and payables

Vendors, requisitions, requests for quotation, purchase orders, receipts,
bills, expenses, credits, advances, payments, aging, approvals, returns, and
three-way matching.

### Inventory

Products, services, categories, units, SKUs, barcodes, warehouses, bins,
transfers, adjustments, reorder rules, serials, lots, expiry, FIFO, weighted
average, assemblies, landed cost, pick-pack-ship, stocktake, and valuation.

### Banking and treasury

Bank, cash, and mobile-money accounts; deposits, transfers, cheques, petty cash,
statement imports, matching, reconciliation, and cash-flow visibility.

### Additional enterprise modules

Fixed assets, projects and job costing, budgets and forecasting, payroll and HR,
multi-company, intercompany transactions, consolidation, approval workflows,
custom reports, scheduled reports, API access, and integrations.

## Non-functional requirements

- Strong tenant and company isolation.
- Role and data-level permissions.
- Immutable audit log for sensitive actions.
- Encryption in transit and at rest.
- Automated backups and tested restoration.
- Accessible responsive web UI.
- Export to PDF, XLSX, and CSV.
- Localization-ready text, dates, numbers, and currencies.
- Observability for errors, performance, and security events.

## Current release

The first release is a frontend foundation and executive dashboard using mock
data. It establishes the information architecture, design system, routing
conventions, and typed module boundaries for later screens and APIs.

