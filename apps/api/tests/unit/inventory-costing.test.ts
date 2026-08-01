import { describe, expect, it } from "vitest"
import {
  transferInboundCost,
  WeightedAverageInventoryCostingService,
  type InventoryCostingMovement,
} from "../../src/modules/inventory/inventory-costing.js"

const costing = new WeightedAverageInventoryCostingService()

function movement(
  input: Pick<InventoryCostingMovement, "kind"> & Partial<InventoryCostingMovement>,
): InventoryCostingMovement {
  return {
    companyId: "company-1",
    branchId: "branch-1",
    warehouseId: "warehouse-1",
    itemId: "item-1",
    occurredAt: "2026-08-01T08:00:00.000Z",
    sourceModule: "inventory",
    sourceType: "test",
    sourceId: "source-1",
    idempotencyKey: `inventory-test-${input.kind}`,
    ...input,
  } as InventoryCostingMovement
}

describe("weighted-average inventory costing", () => {
  it("receives stock and recalculates its weighted-average cost with scale-4 math", () => {
    const result = costing.apply(
      { quantity: "10", inventoryValue: "100", revision: 4 },
      movement({ kind: "receipt", quantity: "5", unitCost: "20" }),
    )

    expect(result).toMatchObject({
      quantityDelta: "5.0000",
      valueDelta: "100.0000",
      costApplied: "100.0000",
      unitCostApplied: "20.0000",
      after: {
        quantity: "15.0000",
        inventoryValue: "200.0000",
        averageUnitCost: "13.3333",
        revision: 5,
      },
    })
  })

  it("costs a sale proportionally and preserves the exact remaining carrying value", () => {
    const result = costing.apply(
      { quantity: "3", inventoryValue: "10", revision: 0 },
      movement({ kind: "sale", quantity: "1" }),
    )

    expect(result).toMatchObject({
      quantityDelta: "-1.0000",
      valueDelta: "-3.3333",
      costApplied: "3.3333",
      after: {
        quantity: "2.0000",
        inventoryValue: "6.6667",
        averageUnitCost: "3.3334",
      },
    })
  })

  it("removes all residual value when the final quantity is issued", () => {
    const result = costing.apply(
      { quantity: "2", inventoryValue: "6.6667", revision: 1 },
      movement({ kind: "sale", quantity: "2" }),
    )

    expect(result.after).toMatchObject({
      quantity: "0.0000",
      inventoryValue: "0.0000",
      averageUnitCost: "0.0000",
    })
    expect(result.costApplied).toBe("6.6667")
  })

  it("carries the exact outbound value into a warehouse transfer", () => {
    const outbound = costing.apply(
      { quantity: "3", inventoryValue: "10", revision: 0 },
      movement({ kind: "transfer-out", quantity: "1" }),
    )
    const inbound = costing.apply(
      { quantity: "1", inventoryValue: "5", revision: 2 },
      movement({
        kind: "transfer-in",
        warehouseId: "warehouse-2",
        ...transferInboundCost(outbound),
      }),
    )

    expect(inbound.valueDelta).toBe("3.3333")
    expect(inbound.after).toMatchObject({
      quantity: "2.0000",
      inventoryValue: "8.3333",
      averageUnitCost: "4.1667",
    })
  })

  it("capitalizes landed cost without changing quantity", () => {
    const result = costing.apply(
      { quantity: "8", inventoryValue: "80", revision: 1 },
      movement({ kind: "landed-cost", valueAdjustment: "4.25" }),
    )

    expect(result).toMatchObject({
      quantityDelta: "0.0000",
      valueDelta: "4.2500",
      after: {
        quantity: "8.0000",
        inventoryValue: "84.2500",
        averageUnitCost: "10.5313",
      },
    })
  })

  it("rejects negative stock and malformed or over-precision decimals", () => {
    expect(() => costing.apply(
      { quantity: "1", inventoryValue: "10", revision: 0 },
      movement({ kind: "sale", quantity: "1.0001" }),
    )).toThrow("negative stock")

    expect(() => costing.apply(
      { quantity: "1", inventoryValue: "10", revision: 0 },
      movement({ kind: "receipt", quantity: "0.00001", unitCost: "2" }),
    )).toThrow("at most 4 decimal places")
  })

  it("requires exactly one authoritative inbound cost and valid value adjustments", () => {
    expect(() => costing.apply(
      { quantity: "1", inventoryValue: "10", revision: 0 },
      movement({ kind: "receipt", quantity: "1", unitCost: "2", totalCost: "2" }),
    )).toThrow("exactly one")

    expect(() => costing.apply(
      { quantity: "0", inventoryValue: "0", revision: 0 },
      movement({ kind: "landed-cost", valueAdjustment: "1" }),
    )).toThrow("quantity is zero")
  })
})
