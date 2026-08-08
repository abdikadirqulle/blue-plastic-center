import { createHash } from "node:crypto"
import { assertBalanced, decimalToMinor, minorToDecimal } from "./ledger-math.js"

export interface PostingLine {
  accountId?: string
  accountNumber?: string
  systemAccountKey?: string
  description?: string
  debit: string
  credit: string
}

export interface PostingCommand {
  sourceModule: string
  sourceType: string
  sourceId: string
  /** Positive source-document revision that produced this posting, when available. */
  sourceVersion?: number
  postingKind?: "primary" | "reversal" | "adjustment"
  idempotencyKey: string
  transactionDate: string
  currency: string
  exchangeRate?: string
  memo?: string
  reversalOfId?: string
  lines: PostingLine[]
}

export interface PostingResult {
  transactionId: string
  transactionNumber: string
  status: "posted"
  sourceModule: string
  sourceType: string
  sourceId: string
  sourceVersion?: number
  postingKind: string
  postingFingerprint: string
  fiscalPeriodId: string
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stable(child)]),
    )
  return value
}

export function postingRequestHash(command: PostingCommand) {
  return createHash("sha256").update(JSON.stringify(stable(command))).digest("hex")
}

export function postingFingerprint(companyId: string, command: PostingCommand) {
  return createHash("sha256")
    .update(
      [
        companyId,
        command.sourceModule,
        command.sourceType,
        command.sourceId,
        command.postingKind ?? "primary",
      ].join(":"),
    )
    .digest("hex")
}

export function validatePostingCommand(command: PostingCommand) {
  if (!command.idempotencyKey.trim()) throw new Error("Posting idempotency key is required")
  if (!command.sourceModule.trim() || !command.sourceType.trim())
    throw new Error("Posting source module and type are required")
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(command.sourceId))
    throw new Error("Posting source ID must be a UUID")
  if (
    command.sourceVersion !== undefined &&
    (!Number.isSafeInteger(command.sourceVersion) || command.sourceVersion < 1)
  ) throw new Error("Posting source version must be a positive safe integer")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(command.transactionDate))
    throw new Error("Posting transaction date is invalid")
  const date = new Date(`${command.transactionDate}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== command.transactionDate)
    throw new Error("Posting transaction date is invalid")
  if (!/^[A-Z]{3}$/.test(command.currency))
    throw new Error("Posting currency must be a three-letter uppercase code")
  const exchangeRate = command.exchangeRate ?? "1"
  if (!/^\d+(?:\.\d{1,8})?$/.test(exchangeRate) || /^0+(?:\.0+)?$/.test(exchangeRate))
    throw new Error("Posting exchange rate must be a positive decimal with at most 8 places")
  if (command.postingKind && !["primary", "reversal", "adjustment"].includes(command.postingKind))
    throw new Error("Posting kind is invalid")
  if ((command.postingKind === "reversal") !== Boolean(command.reversalOfId))
    throw new Error("Reversal postings require exactly one reversal transaction reference")
  for (const line of command.lines) {
    const references = [line.accountId, line.accountNumber, line.systemAccountKey].filter(Boolean)
    if (references.length !== 1)
      throw new Error("Each posting line requires exactly one account reference")
  }
  assertBalanced(command.lines as unknown as Array<Record<string, unknown>>)
  return command
}

/**
 * Validates the accounting shape of a set of journal lines: at least two lines,
 * exactly one side per line, no negatives, and equal non-zero debits/credits.
 */
function validateJournalEntry(lines: PostingLine[]) {
  if (!Array.isArray(lines) || lines.length < 2)
    throw new Error("Journal entry must contain at least two lines")
  const totals = assertBalanced(lines as unknown as Array<Record<string, unknown>>)
  return {
    lines,
    totalDebit: minorToDecimal(totals.debit),
    totalCredit: minorToDecimal(totals.credit),
  }
}

type JournalEntryDraft = Omit<PostingCommand, "lines"> & { lines: PostingLine[] }

/**
 * Single construction point for every automated posting. Zero-value lines are
 * dropped before validation so callers can build lines unconditionally.
 */
export function createBalancedJournalEntry(draft: JournalEntryDraft): PostingCommand {
  const lines = draft.lines
    .map((line) => ({
      ...line,
      debit: minorToDecimal(decimalToMinor(line.debit)),
      credit: minorToDecimal(decimalToMinor(line.credit)),
    }))
    .filter((line) => line.debit !== "0.0000" || line.credit !== "0.0000")
  validateJournalEntry(lines)
  return validatePostingCommand({ ...draft, lines })
}

/** Builds the mirrored command that reverses an existing posted transaction. */
export function createReversalCommand(input: {
  original: {
    transactionId: string
    sourceModule: string
    sourceType: string
    sourceId: string
    currency: string
    exchangeRate: string
    lines: Array<{ accountId: string; description?: string | null; debit: string; credit: string }>
  }
  reversalDate: string
  idempotencyKey: string
  memo?: string
}): PostingCommand {
  return createBalancedJournalEntry({
    sourceModule: input.original.sourceModule,
    sourceType: input.original.sourceType,
    sourceId: input.original.sourceId,
    postingKind: "reversal",
    reversalOfId: input.original.transactionId,
    idempotencyKey: input.idempotencyKey,
    transactionDate: input.reversalDate,
    currency: input.original.currency,
    exchangeRate: input.original.exchangeRate,
    memo: input.memo,
    lines: input.original.lines.map((line) => ({
      accountId: line.accountId,
      description: line.description ?? undefined,
      debit: line.credit,
      credit: line.debit,
    })),
  })
}
