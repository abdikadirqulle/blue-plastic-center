import type { PostingCommand } from "../accounting/posting-engine.js"

const SCALE = 10_000n
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type TransferAccountKind = "bank" | "cash" | "credit-card" | "mobile-money"
export type TransferLedgerClassification = "asset" | "liability"

export interface TransferPostingAccount {
  /** Operational bank/cash account identifier. */
  id: string
  companyId: string
  branchId?: string | null
  currency: string
  accountKind: TransferAccountKind
  ledgerClassification: TransferLedgerClassification
  ledgerAccountId: string
  active: boolean
  /** Optional current spendable balance/credit limit used for an early domain guard. */
  availableToTransfer?: string
  allowsOverdraft?: boolean
}

export interface TransferFeePostingAccount {
  companyId: string
  branchId?: string | null
  ledgerAccountId: string
  ledgerClassification: "expense"
  active: boolean
}

export interface BankTransferFee {
  amount: string
  expenseAccount: TransferFeePostingAccount
  description?: string
}

export interface BankTransferPostingInput {
  id: string
  companyId: string
  branchId?: string | null
  idempotencyKey: string
  transferDate: string
  currency: string
  amount: string
  fromAccount: TransferPostingAccount
  toAccount: TransferPostingAccount
  fee?: BankTransferFee
  memo?: string
}

function parseScale4(value: string, label: string): bigint {
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(value)) {
    throw new Error(`${label} must be a non-negative decimal string with at most 4 decimal places`)
  }
  const [whole = "0", fraction = ""] = value.split(".")
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0"))
}

function formatScale4(value: bigint): string {
  const whole = value / SCALE
  const fraction = String(value % SCALE).padStart(4, "0")
  return `${whole}.${fraction}`
}

function requireUuid(value: string, label: string): void {
  if (!UUID_PATTERN.test(value)) throw new Error(`${label} must be a UUID`)
}

function requireCurrency(value: string): void {
  if (!/^[A-Z]{3}$/.test(value)) {
    throw new Error("Transfer currency must be a three-letter uppercase code")
  }
}

function assertAccountOwnership(
  input: BankTransferPostingInput,
  account: TransferPostingAccount,
  label: "Source" | "Destination",
): void {
  requireUuid(account.id, `${label} account ID`)
  requireUuid(account.ledgerAccountId, `${label} ledger account ID`)
  if (!account.active) throw new Error(`${label} account is inactive`)
  if (account.companyId !== input.companyId) {
    throw new Error(`${label} account does not belong to the transfer company`)
  }
  if (account.currency !== input.currency) {
    throw new Error(`${label} account currency must match the transfer currency`)
  }
  if (input.branchId && account.branchId && account.branchId !== input.branchId) {
    throw new Error(`${label} account does not belong to the transfer branch`)
  }
  const requiredClassification = account.accountKind === "credit-card" ? "liability" : "asset"
  if (account.ledgerClassification !== requiredClassification) {
    throw new Error(
      `${label} ${account.accountKind} account must map to an ${requiredClassification} ledger account`,
    )
  }
}

function assertSingleBranch(input: BankTransferPostingInput): void {
  const fromBranch = input.fromAccount.branchId
  const toBranch = input.toAccount.branchId
  if (fromBranch && toBranch && fromBranch !== toBranch) {
    throw new Error(
      "Inter-branch transfers require due-to/due-from clearing and cannot use direct transfer posting",
    )
  }
}

function validateFee(
  input: BankTransferPostingInput,
  fee: BankTransferFee,
): bigint {
  const amount = parseScale4(fee.amount, "Bank fee")
  if (amount <= 0n) throw new Error("Bank fee must be greater than zero")
  requireUuid(fee.expenseAccount.ledgerAccountId, "Bank fee ledger account ID")
  if (!fee.expenseAccount.active) throw new Error("Bank fee expense account is inactive")
  if (fee.expenseAccount.companyId !== input.companyId) {
    throw new Error("Bank fee expense account does not belong to the transfer company")
  }
  if (
    input.branchId &&
    fee.expenseAccount.branchId &&
    fee.expenseAccount.branchId !== input.branchId
  ) {
    throw new Error("Bank fee expense account does not belong to the transfer branch")
  }
  if (fee.expenseAccount.ledgerClassification !== "expense") {
    throw new Error("Bank fee must post to an expense ledger account")
  }
  if (
    fee.expenseAccount.ledgerAccountId === input.fromAccount.ledgerAccountId ||
    fee.expenseAccount.ledgerAccountId === input.toAccount.ledgerAccountId
  ) {
    throw new Error("Bank fee expense account must be separate from transfer accounts")
  }
  return amount
}

/**
 * Maps one approved bank/cash transfer to a balanced accounting command.
 *
 * A transfer is a balance-sheet movement: debit destination and credit source.
 * It never creates revenue or expense. The only permitted P&L line is an
 * explicitly supplied bank fee, debited to an active expense account and
 * credited to the source account as an additional cash outflow.
 *
 * Cross-currency and inter-branch transfers are rejected until their dedicated
 * FX and due-to/due-from workflows can preserve both currencies and dimensions.
 */
export function mapBankTransferPosting(input: BankTransferPostingInput): PostingCommand {
  requireUuid(input.id, "Transfer ID")
  if (!input.companyId.trim()) throw new Error("Transfer company is required")
  if (!input.idempotencyKey.trim()) throw new Error("Transfer idempotency key is required")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.transferDate)) {
    throw new Error("Transfer date must use YYYY-MM-DD")
  }
  const date = new Date(`${input.transferDate}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.transferDate) {
    throw new Error("Transfer date is invalid")
  }
  requireCurrency(input.currency)
  assertAccountOwnership(input, input.fromAccount, "Source")
  assertAccountOwnership(input, input.toAccount, "Destination")
  assertSingleBranch(input)
  if (input.fromAccount.id === input.toAccount.id) {
    throw new Error("Source and destination accounts must be different")
  }
  if (input.fromAccount.ledgerAccountId === input.toAccount.ledgerAccountId) {
    throw new Error("Source and destination must map to different ledger accounts")
  }

  const amount = parseScale4(input.amount, "Transfer amount")
  if (amount <= 0n) throw new Error("Transfer amount must be greater than zero")
  const fee = input.fee ? validateFee(input, input.fee) : 0n
  const sourceOutflow = amount + fee

  if (
    input.fromAccount.availableToTransfer !== undefined &&
    !input.fromAccount.allowsOverdraft
  ) {
    const available = parseScale4(
      input.fromAccount.availableToTransfer,
      "Source available balance",
    )
    if (sourceOutflow > available) {
      throw new Error("Transfer amount and bank fee exceed the source available balance")
    }
  }

  const description = input.memo?.trim() || "Bank transfer"
  const lines: PostingCommand["lines"] = [
    {
      accountId: input.toAccount.ledgerAccountId,
      description,
      debit: formatScale4(amount),
      credit: "0.0000",
    },
  ]

  if (input.fee) {
    lines.push({
      accountId: input.fee.expenseAccount.ledgerAccountId,
      description: input.fee.description?.trim() || "Bank transfer fee",
      debit: formatScale4(fee),
      credit: "0.0000",
    })
  }

  lines.push({
    accountId: input.fromAccount.ledgerAccountId,
    description,
    debit: "0.0000",
    credit: formatScale4(sourceOutflow),
  })

  return {
    sourceModule: "banking",
    sourceType: "transfer",
    sourceId: input.id,
    postingKind: "primary",
    idempotencyKey: input.idempotencyKey,
    transactionDate: input.transferDate,
    currency: input.currency,
    exchangeRate: "1.0000",
    memo: input.memo?.trim() || undefined,
    lines,
  }
}
