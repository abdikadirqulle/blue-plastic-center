import { isSystemAccountKey, type SystemAccountKey } from "./system-accounts.js"

export const postingEvents = [
  "invoice",
  "customer_payment",
  "sales_receipt",
  "vendor_bill",
  "inventory_opening",
  "bank_transfer",
] as const
export type PostingEvent = (typeof postingEvents)[number]

export const postingRoles = [
  "receivable",
  "payable",
  "revenue",
  "sales_discount",
  "inventory_asset",
  "cost_of_goods_sold",
  "tax_payable",
  "deposit",
  "opening_equity",
  "transfer_source",
  "transfer_destination",
  "bank_fee",
] as const
export type PostingRole = (typeof postingRoles)[number]

export const postingOverrideSources = [
  "customer_receivable_account",
  "vendor_payable_account",
  "item_income_account",
  "item_inventory_account",
  "item_expense_account",
  "tax_sales_account",
  "tax_purchase_account",
  "deposit_account",
  "bank_ledger_account",
  "bank_fee_expense_account",
] as const
export type PostingOverrideSource = (typeof postingOverrideSources)[number]
export type PostingSide = "debit" | "credit"

const events = new Set<string>(postingEvents)
const roles = new Set<string>(postingRoles)
const overrideSources = new Set<string>(postingOverrideSources)

export const isPostingEvent = (value: string): value is PostingEvent => events.has(value)
export const isPostingRole = (value: string): value is PostingRole => roles.has(value)
export const isPostingOverrideSource = (value: string): value is PostingOverrideSource =>
  overrideSources.has(value)

export interface PostingProfileLineDefinition {
  id: string
  role: PostingRole
  side: PostingSide
  accountMeaning?: SystemAccountKey
  overrideSource?: PostingOverrideSource
  lineNumber: number
}

export interface PostingProfileDefinition {
  id: string
  companyId: string
  code: PostingEvent
  name: string
  active: boolean
  version: number
  lines: PostingProfileLineDefinition[]
}

export function validatePostingProfile(profile: PostingProfileDefinition) {
  if (!isPostingEvent(profile.code)) throw new Error(`Unknown posting event: ${profile.code}`)
  if (!profile.active) throw new Error(`Posting profile ${profile.code} is inactive`)
  if (profile.lines.length === 0) throw new Error(`Posting profile ${profile.code} has no lines`)
  const rolesSeen = new Set<PostingRole>()
  for (const line of profile.lines) {
    if (!isPostingRole(line.role)) throw new Error(`Unknown posting role: ${line.role}`)
    if (rolesSeen.has(line.role)) throw new Error(`Posting role ${line.role} is duplicated`)
    rolesSeen.add(line.role)
    if (line.side !== "debit" && line.side !== "credit") {
      throw new Error(`Posting role ${line.role} has an invalid side`)
    }
    if (line.accountMeaning && !isSystemAccountKey(line.accountMeaning)) {
      throw new Error(`Posting role ${line.role} has an unknown account meaning`)
    }
    if (line.overrideSource && !isPostingOverrideSource(line.overrideSource)) {
      throw new Error(`Posting role ${line.role} has an unknown override source`)
    }
    if (!line.accountMeaning && !line.overrideSource) {
      throw new Error(`Posting role ${line.role} requires an account source`)
    }
  }
  return profile
}
