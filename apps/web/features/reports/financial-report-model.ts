export interface TrialBalanceRow {
  accountId?: string
  accountNumber?: string
  accountName?: string
  accountType?: string
  debit?: string
  credit?: string
}

export interface FinancialLine {
  label: string
  amount?: number
  level: 0 | 1
  style: "section" | "account" | "subtotal" | "total"
}

const number = (value: unknown) => Number(value ?? 0)
const debitBalance = (row: TrialBalanceRow) => number(row.debit) - number(row.credit)
const creditBalance = (row: TrialBalanceRow) => number(row.credit) - number(row.debit)

function accounts(rows: TrialBalanceRow[], types: string[], normal: "debit" | "credit"): FinancialLine[] {
  return rows
    .filter((row) => types.includes(row.accountType ?? ""))
    .map((row) => ({
      label: `${row.accountNumber ?? ""} ${row.accountName ?? "Account"}`.trim(),
      amount: normal === "debit" ? debitBalance(row) : creditBalance(row),
      level: 1 as const,
      style: "account" as const,
    }))
    .filter((line) => Math.abs(line.amount) > 0.0001)
}

const sum = (lines: FinancialLine[]) => lines.reduce((total, line) => total + (line.amount ?? 0), 0)

export function buildFinancialLines(kind: string, rows: TrialBalanceRow[]): FinancialLine[] | null {
  if (kind === "profit-and-loss") {
    const income = accounts(rows, ["income"], "credit")
    const cost = accounts(rows, ["cost-of-goods-sold"], "debit")
    const expenses = accounts(rows, ["expense"], "debit")
    const totalIncome = sum(income)
    const totalCost = sum(cost)
    const grossProfit = totalIncome - totalCost
    const totalExpenses = sum(expenses)
    return [
      { label: "Income", level: 0, style: "section" }, ...income,
      { label: "Total Income", amount: totalIncome, level: 0, style: "subtotal" },
      { label: "Cost of Goods Sold", level: 0, style: "section" }, ...cost,
      { label: "Total Cost of Goods Sold", amount: totalCost, level: 0, style: "subtotal" },
      { label: "Gross Profit", amount: grossProfit, level: 0, style: "total" },
      { label: "Expenses", level: 0, style: "section" }, ...expenses,
      { label: "Total Expenses", amount: totalExpenses, level: 0, style: "subtotal" },
      { label: "Net Income", amount: grossProfit - totalExpenses, level: 0, style: "total" },
    ]
  }
  if (kind === "balance-sheet") {
    const assets = accounts(rows, ["asset"], "debit")
    const liabilities = accounts(rows, ["liability"], "credit")
    const equity = accounts(rows, ["equity"], "credit")
    const totalAssets = sum(assets)
    const totalLiabilities = sum(liabilities)
    const postedEquity = sum(equity)
    const currentEarnings = totalAssets - totalLiabilities - postedEquity
    const totalEquity = postedEquity + currentEarnings
    return [
      { label: "Assets", level: 0, style: "section" }, ...assets,
      { label: "Total Assets", amount: totalAssets, level: 0, style: "total" },
      { label: "Liabilities", level: 0, style: "section" }, ...liabilities,
      { label: "Total Liabilities", amount: totalLiabilities, level: 0, style: "subtotal" },
      { label: "Equity", level: 0, style: "section" }, ...equity,
      { label: "Net Income", amount: currentEarnings, level: 1, style: "account" },
      { label: "Total Equity", amount: totalEquity, level: 0, style: "subtotal" },
      { label: "Total Liabilities and Equity", amount: totalLiabilities + totalEquity, level: 0, style: "total" },
    ]
  }
  return null
}

export const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value)
