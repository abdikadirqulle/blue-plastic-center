const SCALE = 10_000n

export const INVENTORY_QUANTITY_SCALE = 4
export const INVENTORY_VALUE_SCALE = 4

export type InventoryInboundMovementKind =
  | "receipt"
  | "transfer-in"
  | "positive-adjustment"
  | "assembly-output"
  | "opening-balance"

export type InventoryOutboundMovementKind =
  | "sale"
  | "transfer-out"
  | "negative-adjustment"
  | "assembly-component"
  | "vendor-return"

export type InventoryValueMovementKind = "landed-cost" | "cost-revaluation"

export interface InventoryBalanceSnapshot {
  quantity: string
  inventoryValue: string
  revision: number
}

interface InventoryMovementIdentity {
  companyId: string
  branchId: string
  warehouseId: string
  itemId: string
  occurredAt: string
  sourceModule: string
  sourceType: string
  sourceId: string
  idempotencyKey: string
}

export interface InventoryInboundMovement extends InventoryMovementIdentity {
  kind: InventoryInboundMovementKind
  quantity: string
  /** Supply unitCost or totalCost, never both. totalCost preserves transfer values exactly. */
  unitCost?: string
  totalCost?: string
}

export interface InventoryOutboundMovement extends InventoryMovementIdentity {
  kind: InventoryOutboundMovementKind
  quantity: string
}

export interface InventoryValueMovement extends InventoryMovementIdentity {
  kind: InventoryValueMovementKind
  /** A signed inventory-value change. Landed cost must be positive. */
  valueAdjustment: string
}

export type InventoryCostingMovement =
  | InventoryInboundMovement
  | InventoryOutboundMovement
  | InventoryValueMovement

export interface InventoryCostingResult {
  movement: InventoryCostingMovement
  before: InventoryBalanceSnapshot & { averageUnitCost: string }
  after: InventoryBalanceSnapshot & { averageUnitCost: string }
  quantityDelta: string
  valueDelta: string
  /** Authoritative cost used by COGS, transfers, assemblies, and returns. */
  costApplied: string
  unitCostApplied: string
}

function parseScale4(value: string, label: string): bigint {
  if (!/^-?(?:0|[1-9]\d*)(?:\.\d{1,4})?$/.test(value)) {
    throw new Error(`${label} must be a decimal string with at most 4 decimal places`)
  }
  const negative = value.startsWith("-")
  const unsigned = negative ? value.slice(1) : value
  const [whole = "0", fraction = ""] = unsigned.split(".")
  const scaled = BigInt(whole) * SCALE + BigInt(fraction.padEnd(4, "0"))
  return negative ? -scaled : scaled
}

function formatScale4(value: bigint): string {
  const negative = value < 0n
  const absolute = negative ? -value : value
  return `${negative ? "-" : ""}${absolute / SCALE}.${String(absolute % SCALE).padStart(4, "0")}`
}

function roundedDivide(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) throw new Error("Inventory costing divisor must be positive")
  if (numerator < 0n) return -roundedDivide(-numerator, denominator)
  return (numerator + denominator / 2n) / denominator
}

function multiplyScale4(left: bigint, right: bigint): bigint {
  return roundedDivide(left * right, SCALE)
}

function averageUnitCost(quantity: bigint, value: bigint): bigint {
  return quantity === 0n ? 0n : roundedDivide(value * SCALE, quantity)
}

function requirePositive(value: bigint, label: string): void {
  if (value <= 0n) throw new Error(`${label} must be greater than zero`)
}

function assertIdentity(movement: InventoryCostingMovement): void {
  const required = [
    [movement.companyId, "companyId"],
    [movement.branchId, "branchId"],
    [movement.warehouseId, "warehouseId"],
    [movement.itemId, "itemId"],
    [movement.sourceModule, "sourceModule"],
    [movement.sourceType, "sourceType"],
    [movement.sourceId, "sourceId"],
    [movement.idempotencyKey, "idempotencyKey"],
  ] as const
  for (const [value, label] of required) {
    if (!value.trim()) throw new Error(`${label} is required for an inventory movement`)
  }
  if (Number.isNaN(Date.parse(movement.occurredAt))) {
    throw new Error("occurredAt must be a valid date")
  }
}

function normalizeBalance(balance: InventoryBalanceSnapshot) {
  if (!Number.isSafeInteger(balance.revision) || balance.revision < 0) {
    throw new Error("Inventory balance revision must be a non-negative safe integer")
  }
  const quantity = parseScale4(balance.quantity, "Inventory quantity")
  const inventoryValue = parseScale4(balance.inventoryValue, "Inventory value")
  if (quantity < 0n || inventoryValue < 0n) {
    throw new Error("Inventory quantity and value cannot be negative")
  }
  if (quantity === 0n && inventoryValue !== 0n) {
    throw new Error("Zero inventory quantity must have zero inventory value")
  }
  return { quantity, inventoryValue }
}

function isInbound(
  movement: InventoryCostingMovement,
): movement is InventoryInboundMovement {
  return [
    "receipt",
    "transfer-in",
    "positive-adjustment",
    "assembly-output",
    "opening-balance",
  ].includes(movement.kind)
}

function isOutbound(
  movement: InventoryCostingMovement,
): movement is InventoryOutboundMovement {
  return [
    "sale",
    "transfer-out",
    "negative-adjustment",
    "assembly-component",
    "vendor-return",
  ].includes(movement.kind)
}

/**
 * Pure weighted-average inventory costing engine.
 *
 * Persistence must lock one company/item/warehouse balance, enforce the
 * idempotency key, append the immutable movement, and update the balance in a
 * single database transaction before publishing the returned accounting cost.
 */
export class WeightedAverageInventoryCostingService {
  apply(
    balance: InventoryBalanceSnapshot,
    movement: InventoryCostingMovement,
  ): InventoryCostingResult {
    assertIdentity(movement)
    const before = normalizeBalance(balance)
    let quantityDelta = 0n
    let valueDelta = 0n
    let costApplied = 0n
    let unitCostApplied = 0n

    if (isInbound(movement)) {
      const quantity = parseScale4(movement.quantity, "Inbound quantity")
      requirePositive(quantity, "Inbound quantity")
      const hasUnitCost = movement.unitCost !== undefined
      const hasTotalCost = movement.totalCost !== undefined
      if (hasUnitCost === hasTotalCost) {
        throw new Error("Inbound movement must supply exactly one of unitCost or totalCost")
      }
      if (hasTotalCost) {
        costApplied = parseScale4(movement.totalCost ?? "", "Inbound total cost")
        if (costApplied < 0n) throw new Error("Inbound total cost cannot be negative")
        unitCostApplied = averageUnitCost(quantity, costApplied)
      } else {
        unitCostApplied = parseScale4(movement.unitCost ?? "", "Inbound unit cost")
        if (unitCostApplied < 0n) throw new Error("Inbound unit cost cannot be negative")
        costApplied = multiplyScale4(quantity, unitCostApplied)
      }
      quantityDelta = quantity
      valueDelta = costApplied
    } else if (isOutbound(movement)) {
      const quantity = parseScale4(movement.quantity, "Outbound quantity")
      requirePositive(quantity, "Outbound quantity")
      if (quantity > before.quantity) {
        throw new Error("Inventory movement would create negative stock")
      }
      // Allocate the current carrying value proportionally. This preserves the
      // remaining balance exactly and removes all rounding residue on depletion.
      costApplied = quantity === before.quantity
        ? before.inventoryValue
        : roundedDivide(before.inventoryValue * quantity, before.quantity)
      unitCostApplied = averageUnitCost(quantity, costApplied)
      quantityDelta = -quantity
      valueDelta = -costApplied
    } else {
      if (before.quantity === 0n) {
        throw new Error("Inventory value cannot be adjusted when quantity is zero")
      }
      valueDelta = parseScale4(movement.valueAdjustment, "Inventory value adjustment")
      if (movement.kind === "landed-cost" && valueDelta <= 0n) {
        throw new Error("Landed cost must increase inventory value")
      }
      if (valueDelta === 0n) throw new Error("Inventory value adjustment cannot be zero")
      if (before.inventoryValue + valueDelta < 0n) {
        throw new Error("Inventory value adjustment would create negative inventory value")
      }
      costApplied = valueDelta
      unitCostApplied = roundedDivide(valueDelta * SCALE, before.quantity)
    }

    const afterQuantity = before.quantity + quantityDelta
    const afterValue = before.inventoryValue + valueDelta
    if (afterQuantity < 0n || afterValue < 0n) {
      throw new Error("Inventory movement would create a negative balance")
    }
    if (afterQuantity === 0n && afterValue !== 0n) {
      throw new Error("Inventory depletion must remove the complete carrying value")
    }

    return {
      movement,
      before: {
        ...balance,
        quantity: formatScale4(before.quantity),
        inventoryValue: formatScale4(before.inventoryValue),
        averageUnitCost: formatScale4(averageUnitCost(before.quantity, before.inventoryValue)),
      },
      after: {
        quantity: formatScale4(afterQuantity),
        inventoryValue: formatScale4(afterValue),
        averageUnitCost: formatScale4(averageUnitCost(afterQuantity, afterValue)),
        revision: balance.revision + 1,
      },
      quantityDelta: formatScale4(quantityDelta),
      valueDelta: formatScale4(valueDelta),
      costApplied: formatScale4(costApplied),
      unitCostApplied: formatScale4(unitCostApplied),
    }
  }
}

export function transferInboundCost(
  outbound: InventoryCostingResult,
): Pick<InventoryInboundMovement, "quantity" | "totalCost"> {
  if (outbound.valueDelta[0] !== "-" || outbound.quantityDelta[0] !== "-") {
    throw new Error("Transfer-in cost requires an outbound costing result")
  }
  return {
    quantity: outbound.quantityDelta.slice(1),
    totalCost: outbound.valueDelta.slice(1),
  }
}
