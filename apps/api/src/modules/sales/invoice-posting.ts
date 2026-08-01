import {
  createBalancedJournalEntry,
  type PostingCommand,
  type PostingLine,
} from "../accounting/posting-engine.js"
import { decimalToMinor, minorToDecimal } from "../accounting/ledger-math.js"
import { systemAccountKeys, type SystemAccountKey } from "../accounting/system-accounts.js"

export interface InvoicePostingLine {
  /** Resolved revenue account. Falls back to a system key when unresolved. */
  revenueAccountId?: string
  revenueSystemAccountKey?: SystemAccountKey
  description: string
  /** Net of the line discount and excluding tax. */
  lineTotal: string
  discountAmount: string
  taxAmount: string
  /** Weighted-average cost released by an inventory line. */
  cost?: string
  inventoryAccountId?: string
  cogsAccountId?: string
}

export interface InvoicePostingInput {
  invoiceId: string
  invoiceNumber: string
  invoiceDate: string
  currency: string
  exchangeRate: string
  customerName: string
  receivableAccountId?: string
  total: string
  discountTotal: string
  taxTotal: string
  idempotencyKey: string
  lines: InvoicePostingLine[]
}

function accountReference(
  accountId: string | undefined,
  systemAccountKey: SystemAccountKey,
): Pick<PostingLine, "accountId" | "systemAccountKey"> {
  return accountId ? { accountId } : { systemAccountKey }
}

/**
 * Builds the canonical invoice journal.
 *
 * Debit accounts receivable, credit each revenue line, credit tax payable, and
 * for inventory lines debit cost of goods sold against the inventory asset.
 */
export function buildInvoicePosting(input: InvoicePostingInput): PostingCommand {
  const lineDiscountTotal = input.lines.reduce(
    (total, line) => total + decimalToMinor(line.discountAmount),
    0n,
  )
  const documentDiscount = decimalToMinor(input.discountTotal) - lineDiscountTotal
  if (documentDiscount < 0n) throw new Error("Invoice discount totals are inconsistent")

  const revenueLines: PostingLine[] = input.lines.map((line) => ({
    ...accountReference(line.revenueAccountId, line.revenueSystemAccountKey ?? systemAccountKeys.SALES_REVENUE),
    description: line.description,
    debit: "0",
    credit: line.lineTotal,
  }))

  const costLines: PostingLine[] = input.lines.flatMap((line) => {
    if (!line.cost || decimalToMinor(line.cost) === 0n) return []
    return [
      {
        ...accountReference(line.cogsAccountId, systemAccountKeys.COST_OF_GOODS_SOLD),
        description: `Cost of goods sold — ${line.description}`,
        debit: line.cost,
        credit: "0",
      },
      {
        ...accountReference(line.inventoryAccountId, systemAccountKeys.INVENTORY_ASSET),
        description: `Inventory relief — ${line.description}`,
        debit: "0",
        credit: line.cost,
      },
    ]
  })

  return createBalancedJournalEntry({
    sourceModule: "sales",
    sourceType: "invoice",
    sourceId: input.invoiceId,
    postingKind: "primary",
    idempotencyKey: input.idempotencyKey,
    transactionDate: input.invoiceDate,
    currency: input.currency,
    exchangeRate: input.exchangeRate,
    memo: `Invoice ${input.invoiceNumber}`,
    lines: [
      {
        ...accountReference(input.receivableAccountId, systemAccountKeys.ACCOUNTS_RECEIVABLE),
        description: `Accounts receivable — ${input.customerName}`,
        debit: input.total,
        credit: "0",
      },
      ...revenueLines,
      {
        systemAccountKey: systemAccountKeys.SALES_DISCOUNTS,
        description: `Sales discount — ${input.invoiceNumber}`,
        debit: minorToDecimal(documentDiscount),
        credit: "0",
      },
      {
        systemAccountKey: systemAccountKeys.TAX_PAYABLE,
        description: `Sales tax — ${input.invoiceNumber}`,
        debit: "0",
        credit: input.taxTotal,
      },
      ...costLines,
    ],
  })
}
