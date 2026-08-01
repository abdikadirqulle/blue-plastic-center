import type { RequestContext } from "../../platform/types.js"

export interface InventoryMovementRequest {
  warehouseId: string
  itemId: string
  kind: "sale" | "negative-adjustment" | "positive-adjustment" | "receipt"
  quantity: string
  occurredAt: string
  sourceModule: string
  sourceType: string
  sourceId: string
  sourceLineId?: string
  /** Unique per movement. Repeating it returns the recorded movement unchanged. */
  idempotencyKey: string
  /** Required for inbound movements only. */
  unitCost?: string
  totalCost?: string
}

export interface InventoryMovementRecord {
  id: string
  warehouseId: string
  itemId: string
  kind: string
  quantityDelta: string
  valueDelta: string
  unitCost: string
  quantityAfter: string
  valueAfter: string
  sourceModule: string
  sourceType: string
  sourceId: string
  sourceLineId?: string
  idempotencyKey: string
  occurredAt: string
  /** Positive cost released to the ledger by an outbound movement. */
  costApplied: string
}

/**
 * Transaction-scoped stock ledger port. The implementation must apply the
 * movement, update the balance, and enforce the idempotency key inside the same
 * unit of work as the document that caused it.
 */
export interface InventoryMovementPort<TTransaction = unknown> {
  apply(
    transaction: TTransaction,
    context: RequestContext,
    request: InventoryMovementRequest,
  ): Promise<InventoryMovementRecord>
  /**
   * Pass the caller's transaction to see movements it has just written; without
   * one the read runs on its own connection and cannot observe them.
   */
  listBySource(
    context: RequestContext,
    source: { sourceModule: string; sourceType: string; sourceId: string },
    transaction?: TTransaction,
  ): Promise<InventoryMovementRecord[]>
}
