import { randomUUID } from "node:crypto"
import { validation } from "../../platform/errors.js"
import type { RequestContext } from "../../platform/types.js"
import { addDecimals } from "../read-models/balance-math.js"
import {
  WeightedAverageInventoryCostingService,
  type InventoryBalanceSnapshot,
  type InventoryCostingMovement,
} from "./inventory-costing.js"
import type {
  InventoryMovementPort,
  InventoryMovementRecord,
  InventoryMovementRequest,
  InventoryReadPort,
  InventoryStockLevel,
} from "./inventory-movement-port.js"

interface StoredMovement extends InventoryMovementRecord {
  companyId: string
}

const balanceKey = (companyId: string, warehouseId: string, itemId: string) =>
  `${companyId}:${warehouseId}:${itemId}`

const sourceKey = (
  companyId: string,
  source: { sourceModule: string; sourceType: string; sourceId: string },
  idempotencyKey: string,
) =>
  `${companyId}:${source.sourceModule}:${source.sourceType}:${source.sourceId}:${idempotencyKey}`

/**
 * In-memory stock ledger with the same idempotency and costing rules as the
 * PostgreSQL implementation. Used by the default runtime and by tests.
 */
export class MemoryInventoryMovements
  implements InventoryMovementPort<unknown>, InventoryReadPort
{
  private readonly costing = new WeightedAverageInventoryCostingService()
  private balances = new Map<string, InventoryBalanceSnapshot>()
  private movements: StoredMovement[] = []

  /** Captures state so a failed business action can be rolled back whole. */
  snapshot() {
    const balances = new Map(
      [...this.balances.entries()].map(([key, value]) => [key, { ...value }]),
    )
    const movements = [...this.movements]
    return () => {
      this.balances = balances
      this.movements = movements
    }
  }

  seedBalance(input: {
    companyId: string
    warehouseId: string
    itemId: string
    quantity: string
    inventoryValue: string
  }) {
    this.balances.set(balanceKey(input.companyId, input.warehouseId, input.itemId), {
      quantity: input.quantity,
      inventoryValue: input.inventoryValue,
      revision: 0,
    })
  }

  balanceOf(companyId: string, warehouseId: string, itemId: string) {
    return (
      this.balances.get(balanceKey(companyId, warehouseId, itemId)) ?? {
        quantity: "0.0000",
        inventoryValue: "0.0000",
        revision: 0,
      }
    )
  }

  async apply(
    _transaction: unknown,
    context: RequestContext,
    request: InventoryMovementRequest,
  ) {
    const key = sourceKey(context.companyId, request, request.idempotencyKey)
    const existing = this.movements.find(
      (movement) =>
        sourceKey(movement.companyId, movement, movement.idempotencyKey) === key,
    )
    if (existing) return existing

    const balance = this.balanceOf(
      context.companyId,
      request.warehouseId,
      request.itemId,
    )
    let result
    try {
      result = this.costing.apply(balance, {
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
      } as InventoryCostingMovement)
    } catch (error) {
      throw validation(
        error instanceof Error ? error.message : "The inventory movement was rejected",
      )
    }

    this.balances.set(
      balanceKey(context.companyId, request.warehouseId, request.itemId),
      {
        quantity: result.after.quantity,
        inventoryValue: result.after.inventoryValue,
        revision: result.after.revision,
      },
    )
    const movement: StoredMovement = {
      id: randomUUID(),
      companyId: context.companyId,
      warehouseId: request.warehouseId,
      itemId: request.itemId,
      kind: request.kind,
      quantityDelta: result.quantityDelta,
      valueDelta: result.valueDelta,
      unitCost: result.unitCostApplied,
      quantityAfter: result.after.quantity,
      valueAfter: result.after.inventoryValue,
      sourceModule: request.sourceModule,
      sourceType: request.sourceType,
      sourceId: request.sourceId,
      sourceLineId: request.sourceLineId,
      idempotencyKey: request.idempotencyKey,
      occurredAt: request.occurredAt,
      costApplied: result.costApplied,
    }
    this.movements = [...this.movements, movement]
    return movement
  }

  async listBySource(
    context: RequestContext,
    source: { sourceModule: string; sourceType: string; sourceId: string },
  ) {
    return this.movements.filter(
      (movement) =>
        movement.companyId === context.companyId &&
        movement.sourceModule === source.sourceModule &&
        movement.sourceType === source.sourceType &&
        movement.sourceId === source.sourceId,
    )
  }

  async stockLevels(context: RequestContext, itemIds: string[]) {
    const wanted = new Set(itemIds)
    const totals = new Map<string, InventoryStockLevel>()
    for (const [key, balance] of this.balances) {
      const [companyId, , itemId] = key.split(":")
      if (companyId !== context.companyId || !wanted.has(itemId)) continue
      const current = totals.get(itemId) ?? {
        itemId,
        quantity: "0.0000",
        inventoryValue: "0.0000",
      }
      totals.set(itemId, {
        itemId,
        quantity: addDecimals(current.quantity, balance.quantity),
        inventoryValue: addDecimals(
          current.inventoryValue,
          balance.inventoryValue,
        ),
      })
    }
    return [...totals.values()]
  }

  async listByItem(context: RequestContext, itemId: string, limit: number) {
    return this.movements
      .filter(
        (movement) =>
          movement.companyId === context.companyId && movement.itemId === itemId,
      )
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
      .slice(-limit)
  }
}
