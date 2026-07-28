import { describe, expect, it } from "vitest"
import { buildFinancialLines } from "../features/reports/financial-report-model"

const rows = [
  { accountNumber: "1020", accountName: "Bank", accountType: "asset", debit: "180", credit: "0" },
  { accountNumber: "3000", accountName: "Owner equity", accountType: "equity", debit: "0", credit: "100" },
  { accountNumber: "4010", accountName: "Sales", accountType: "income", debit: "0", credit: "120" },
  { accountNumber: "5000", accountName: "COGS", accountType: "cost-of-goods-sold", debit: "25", credit: "0" },
  { accountNumber: "6000", accountName: "Wages", accountType: "expense", debit: "15", credit: "0" },
]

describe("financial report model", () => {
  it("calculates profit and loss subtotals", () => {
    const lines = buildFinancialLines("profit-and-loss", rows)
    expect(lines?.find((line) => line.label === "Gross Profit")?.amount).toBe(95)
    expect(lines?.find((line) => line.label === "Net Income")?.amount).toBe(80)
  })

  it("adds current earnings so the balance sheet balances", () => {
    const lines = buildFinancialLines("balance-sheet", rows)
    expect(lines?.find((line) => line.label === "Total Assets")?.amount).toBe(180)
    expect(lines?.find((line) => line.label === "Total Liabilities and Equity")?.amount).toBe(180)
  })
})
