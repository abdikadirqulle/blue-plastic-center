import { and, eq, inArray, sql } from "drizzle-orm"
import type { Database, DatabaseTransaction } from "../../db/client.js"
import { inventoryBalances, inventoryMovements } from "../../db/schema.js"
import { conflict, validation } from "../../platform/errors.js"
import type { RequestContext } from "../../platform/types.js"
import {
  WeightedAverageInventoryCostingService,
  type InventoryCostingMovement,
} from "./inventory-costing.js"
import type {
  InventoryMovementPort,
  InventoryMovementRecord,
  InventoryMovementRequest,
  InventoryReadPort,
} from "./inventory-movement-port.js"

type MovementRow = typeof inventoryMovements.$inferSelect

function toRecord(row: MovementRow): InventoryMovementRecord {
  const valueDelta = row.valueDelta.startsWith("-") ? row.valueDelta.slice(1) : "0"
  return {
    id: row.id,
    warehouseId: row.warehouseId,
    itemId: row.itemId,
    kind: row.kind,
    quantityDelta: row.quantityDelta,
    valueDelta: row.valueDelta,
    unitCost: row.unitCost,
    quantityAfter: row.quantityAfter,
    valueAfter: row.valueAfter,
    sourceModule: row.sourceModule,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceLineId: row.sourceLineId ?? undefined,
    idempotencyKey: row.idempotencyKey,
    occurredAt: row.occurredAt.toISOString(),
    costApplied: valueDelta,
  }
}

export class PostgresInventoryMovements
  implements InventoryMovementPort<DatabaseTransaction>, InventoryReadPort
{
  private readonly costing = new WeightedAverageInventoryCostingService()

  constructor(private readonly db: Database) {}

  async apply(
    transaction: DatabaseTransaction,
    context: RequestContext,
    request: InventoryMovementRequest,
  ) {
    const [existing] = await transaction
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.companyId, context.companyId),
          eq(inventoryMovements.sourceModule, request.sourceModule),
          eq(inventoryMovements.sourceType, request.sourceType),
          eq(inventoryMovements.sourceId, request.sourceId),
          eq(inventoryMovements.idempotencyKey, request.idempotencyKey),
        ),
      )
      .limit(1)
    if (existing) return toRecord(existing)

    // The balance row is locked for the rest of the transaction so two
    // concurrent posts cannot read the same carrying value.
    await transaction
      .insert(inventoryBalances)
      .values({
        companyId: context.companyId,
        warehouseId: request.warehouseId,
        itemId: request.itemId,
      })
      .onConflictDoNothing()
    const [balance] = await transaction
      .select()
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.companyId, context.companyId),
          eq(inventoryBalances.warehouseId, request.warehouseId),
          eq(inventoryBalances.itemId, request.itemId),
        ),
      )
      .for("update")
      .limit(1)
    if (!balance) throw conflict("The inventory balance could not be locked")

    let result
    try {
      result = this.costing.apply(
        {
          quantity: balance.quantity,
          inventoryValue: balance.inventoryValue,
          revision: balance.revision,
        },
        {
          companyId: context.companyId,
          branchId: context.branchId,
          warehouseId: request.warehouseId,
          itemId: request.itemId,
          occurredAt: request.occurredAt,
          sourceModule: request.sourceModule,
          sourceType: request.sourceType,
          sourceId: request.sourceId,
          idempotencyKey: request.idempotencyKey,
          kind: request.kind,
          quantity: request.quantity,
          ...(request.unitCost !== undefined ? { unitCost: request.unitCost } : {}),
          ...(request.totalCost !== undefined ? { totalCost: request.totalCost } : {}),
        } as InventoryCostingMovement,
      )
    } catch (error) {
      throw validation(
        error instanceof Error ? error.message : "The inventory movement was rejected",
      )
    }

    const [updatedBalance] = await transaction
      .update(inventoryBalances)
      .set({
        quantity: result.after.quantity,
        inventoryValue: result.after.inventoryValue,
        revision: result.after.revision,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inventoryBalances.id, balance.id),
          eq(inventoryBalances.revision, balance.revision),
        ),
      )
      .returning({ id: inventoryBalances.id })
    if (!updatedBalance) throw conflict("The inventory balance changed during posting")

    const [movement] = await transaction
      .insert(inventoryMovements)
      .values({
        companyId: context.companyId,
        branchId: context.branchId,
        warehouseId: request.warehouseId,
        itemId: request.itemId,
        kind: request.kind,
        occurredAt: new Date(request.occurredAt),
        sourceModule: request.sourceModule,
        sourceType: request.sourceType,
        sourceId: request.sourceId,
        sourceLineId: request.sourceLineId,
        idempotencyKey: request.idempotencyKey,
        quantityDelta: result.quantityDelta,
        valueDelta: result.valueDelta,
        unitCost: result.unitCostApplied,
        quantityAfter: result.after.quantity,
        valueAfter: result.after.inventoryValue,
        createdBy: context.principal.userId,
      })
      .onConflictDoNothing()
      .returning()
    if (!movement) throw conflict("The inventory movement was already recorded")
    return { ...toRecord(movement), costApplied: result.costApplied }
  }

  async stockLevels(context: RequestContext, itemIds: string[]) {
    if (!itemIds.length) return []
    const rows = await this.db
      .select({
        itemId: inventoryBalances.itemId,
        quantity: sql<string>`coalesce(sum(${inventoryBalances.quantity}), 0)::text`,
        inventoryValue: sql<string>`coalesce(sum(${inventoryBalances.inventoryValue}), 0)::text`,
      })
      .from(inventoryBalances)
      .where(
        and(
          eq(inventoryBalances.companyId, context.companyId),
          inArray(inventoryBalances.itemId, itemIds),
        ),
      )
      .groupBy(inventoryBalances.itemId)
    return rows
  }

  async listByItem(context: RequestContext, itemId: string, limit: number) {
    const rows = await this.db
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.companyId, context.companyId),
          eq(inventoryMovements.itemId, itemId),
        ),
      )
      .orderBy(sql`${inventoryMovements.occurredAt} desc`)
      .limit(limit)
    return rows.map(toRecord).reverse()
  }

  async listBySource(
    context: RequestContext,
    source: { sourceModule: string; sourceType: string; sourceId: string },
    transaction?: DatabaseTransaction,
  ) {
    const rows = await (transaction ?? this.db)
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.companyId, context.companyId),
          eq(inventoryMovements.sourceModule, source.sourceModule),
          eq(inventoryMovements.sourceType, source.sourceType),
          eq(inventoryMovements.sourceId, source.sourceId),
        ),
      )
      .orderBy(sql`${inventoryMovements.createdAt} asc`)
    return rows.map(toRecord)
  }
}
