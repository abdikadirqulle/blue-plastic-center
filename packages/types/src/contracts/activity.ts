import { z } from "zod";

/**
 * Read models behind the record detail screens.
 *
 * A record on its own only carries what someone typed into a form. The numbers
 * a bookkeeper actually looks for — what a customer still owes, how much stock
 * is left, what an account has moved — live in the ledger, the invoice tables
 * and the stock ledger. These shapes carry those server-calculated figures and
 * the documents behind them, so no screen has to add up money in the browser.
 */

/** A single calculated figure. `format` tells the interface how to render it. */
export const activityMetricSchema = z.object({
  key: z.string(),
  value: z.string(),
  format: z.enum(["money", "quantity", "count", "date", "text"]),
});

export type ActivityMetric = z.infer<typeof activityMetricSchema>;

/**
 * One line of a register: an invoice, a payment, a stock movement or a journal
 * line. Only the fields that apply to the kind are populated.
 */
export const activityRowSchema = z.object({
  id: z.string(),
  /** ISO date the document affected the books. */
  date: z.string(),
  kind: z.enum([
    "invoice",
    "receipt",
    "payment",
    "bill",
    "expense",
    "movement",
    "journal",
  ]),
  reference: z.string(),
  description: z.string(),
  status: z.string().optional(),
  /** Signed money effect on the party or account. */
  amount: z.string().optional(),
  /**
   * Whether the row moves the party balance. A cash sale is settled at the
   * counter, so it belongs in the history without touching what is owed.
   */
  affectsBalance: z.boolean().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  quantity: z.string().optional(),
  unitCost: z.string().optional(),
  /** Balance or quantity carried after this row, oldest to newest. */
  running: z.string().optional(),
  /** Module and resource of the source document, for navigation. */
  source: z
    .object({ module: z.string(), resource: z.string(), id: z.string() })
    .optional(),
});

export type ActivityRow = z.infer<typeof activityRowSchema>;

export const activityAuditEntrySchema = z.object({
  action: z.string(),
  occurredAt: z.string(),
  userId: z.string(),
});

export type ActivityAuditEntry = z.infer<typeof activityAuditEntrySchema>;

/** Which register a record has. `none` means only the audit trail applies. */
export const activityKindSchema = z.enum([
  "customer",
  "vendor",
  "item",
  "account",
  "none",
]);

export type ActivityKind = z.infer<typeof activityKindSchema>;

export const recordActivitySchema = z.object({
  kind: activityKindSchema,
  currency: z.string(),
  metrics: z.array(activityMetricSchema),
  rows: z.array(activityRowSchema),
  audit: z.array(activityAuditEntrySchema),
});

export type RecordActivity = z.infer<typeof recordActivitySchema>;
