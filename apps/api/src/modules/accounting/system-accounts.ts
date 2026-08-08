/**
 * Stable posting keys. Postings reference these keys, never account names or
 * hardcoded identifiers, so a company can renumber or rename its chart of
 * accounts without breaking the engine.
 */
export const systemAccountKeys = {
  ACCOUNTS_RECEIVABLE: "accounts_receivable",
  ACCOUNTS_PAYABLE: "accounts_payable",
  SALES_REVENUE: "sales_revenue",
  SERVICE_REVENUE: "service_revenue",
  SALES_DISCOUNTS: "sales_discounts",
  INVENTORY_ASSET: "inventory_asset",
  COST_OF_GOODS_SOLD: "cost_of_goods_sold",
  TAX_PAYABLE: "tax_payable",
  CASH: "cash",
  BANK: "bank",
  MOBILE_MONEY: "mobile_money",
  OWNER_EQUITY: "owner_capital",
} as const

export type SystemAccountName = keyof typeof systemAccountKeys
export type SystemAccountKey = (typeof systemAccountKeys)[SystemAccountName]

const knownKeys = new Set<string>(Object.values(systemAccountKeys))

export function isSystemAccountKey(value: string): value is SystemAccountKey {
  return knownKeys.has(value)
}

export function systemAccountKey(name: SystemAccountName): SystemAccountKey {
  return systemAccountKeys[name]
}
