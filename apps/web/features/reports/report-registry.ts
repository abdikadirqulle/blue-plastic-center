export const reportKinds = [
  "trial-balance",
  "general-ledger",
  "profit-and-loss",
  "balance-sheet",
  "cash-flow",
  "receivables-aging",
  "payables-aging",
  "inventory-valuation",
  "audit-trail",
  "sales-by-item",
  "sales-by-customer",
  "invoice-list",
  "collections",
] as const

export type ReportKind = (typeof reportKinds)[number]

export interface AvailableReportDefinition {
  status: "available"
  kind: ReportKind
}

export interface UnsupportedReportDefinition {
  status: "unsupported"
  reason: string
}

export type ReportDefinition =
  | AvailableReportDefinition
  | UnsupportedReportDefinition

const availableReports: Readonly<Record<string, ReportKind>> = {
  "Profit and Loss": "profit-and-loss",
  "Balance Sheet": "balance-sheet",
  "Statement of Cash Flows": "cash-flow",
  "Trial Balance": "trial-balance",
  "Audit Trail": "audit-trail",
  "Sales by Customer Summary": "sales-by-customer",
  "Sales by Item Summary": "sales-by-item",
  "Invoice List": "invoice-list",
  "Collections Report": "collections",
  "A/R Aging Summary": "receivables-aging",
  "A/P Aging Summary": "payables-aging",
  "Inventory Valuation Summary": "inventory-valuation",
}

const unsupportedReason =
  "This report needs a dedicated normalized read model and is not available yet."

export function isReportKind(value: string): value is ReportKind {
  return (reportKinds as readonly string[]).includes(value)
}

export function resolveReportDefinition(name: string): ReportDefinition {
  const kind = availableReports[name]
  return kind
    ? { status: "available", kind }
    : { status: "unsupported", reason: unsupportedReason }
}
