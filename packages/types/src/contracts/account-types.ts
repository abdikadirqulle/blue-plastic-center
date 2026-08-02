/**
 * QuickBooks Desktop-style account detail types, mapped to the six ledger
 * families the posting engine and trial balance already understand.
 */

export const accountDetailTypes = [
  "bank",
  "accounts-receivable",
  "other-current-asset",
  "fixed-asset",
  "other-asset",
  "accounts-payable",
  "credit-card",
  "other-current-liability",
  "long-term-liability",
  "equity",
  "income",
  "other-income",
  "cost-of-goods-sold",
  "expense",
  "other-expense",
  // Legacy broad types still accepted from seed / older records.
  "asset",
  "liability",
] as const

export type AccountDetailType = (typeof accountDetailTypes)[number]

export type LedgerFamily =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense"
  | "cost-of-goods-sold"

const familyByDetail: Record<string, LedgerFamily> = {
  bank: "asset",
  "accounts-receivable": "asset",
  "other-current-asset": "asset",
  "fixed-asset": "asset",
  "other-asset": "asset",
  asset: "asset",
  "accounts-payable": "liability",
  "credit-card": "liability",
  "other-current-liability": "liability",
  "long-term-liability": "liability",
  liability: "liability",
  equity: "equity",
  income: "income",
  "other-income": "income",
  "cost-of-goods-sold": "cost-of-goods-sold",
  expense: "expense",
  "other-expense": "expense",
}

/** Maps a stored account type (detail or legacy) to its ledger family. */
export function ledgerFamily(accountType: string | undefined): LedgerFamily {
  return familyByDetail[String(accountType ?? "").toLowerCase()] ?? "expense"
}

/** Labels shown in New Account / quick-add, in QuickBooks order. */
export const accountTypeOptions: Array<{ label: string; value: AccountDetailType }> = [
  { label: "Bank", value: "bank" },
  { label: "Accounts receivable (A/R)", value: "accounts-receivable" },
  { label: "Other current asset", value: "other-current-asset" },
  { label: "Fixed asset", value: "fixed-asset" },
  { label: "Other asset", value: "other-asset" },
  { label: "Accounts payable (A/P)", value: "accounts-payable" },
  { label: "Credit card", value: "credit-card" },
  { label: "Other current liability", value: "other-current-liability" },
  { label: "Long term liability", value: "long-term-liability" },
  { label: "Equity", value: "equity" },
  { label: "Income", value: "income" },
  { label: "Other income", value: "other-income" },
  { label: "Cost of goods sold", value: "cost-of-goods-sold" },
  { label: "Expense", value: "expense" },
  { label: "Other expense", value: "other-expense" },
]
