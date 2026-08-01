export type ReportExecutionStrategy =
  | "ledger-summary"
  | "audit"
  | "sales"
  | "operational"

type AvailableReportDefinition =
  | {
      status: "available"
      strategy: Exclude<ReportExecutionStrategy, "operational">
    }
  | {
      status: "available"
      strategy: "operational"
      source: readonly [module: string, resource: string]
    }

interface UnsupportedReportDefinition {
  status: "unsupported"
  reason: string
}

export type ApiReportDefinition =
  | AvailableReportDefinition
  | UnsupportedReportDefinition

export const reportRegistry = {
  "trial-balance": { status: "available", strategy: "ledger-summary" },
  "profit-and-loss": { status: "available", strategy: "ledger-summary" },
  "balance-sheet": { status: "available", strategy: "ledger-summary" },
  "cash-flow": { status: "available", strategy: "ledger-summary" },
  "audit-trail": { status: "available", strategy: "audit" },
  "sales-by-item": { status: "available", strategy: "sales" },
  "sales-by-customer": { status: "available", strategy: "sales" },
  "invoice-list": { status: "available", strategy: "sales" },
  collections: { status: "available", strategy: "sales" },
  "receivables-aging": {
    status: "available",
    strategy: "operational",
    source: ["debts", "receivables"],
  },
  "payables-aging": {
    status: "available",
    strategy: "operational",
    source: ["debts", "payables"],
  },
  "inventory-valuation": {
    status: "available",
    strategy: "operational",
    source: ["inventory", "stock-levels"],
  },
  "general-ledger": {
    status: "unsupported",
    reason:
      "General Ledger requires transaction-and-line detail and cannot use Trial Balance aggregates.",
  },
} as const satisfies Record<string, ApiReportDefinition>

export type RegisteredReportKind = keyof typeof reportRegistry

export function getReportDefinition(
  kind: string,
): ApiReportDefinition | undefined {
  return reportRegistry[kind as RegisteredReportKind]
}
