import { z } from "zod"
import {
  decimalString,
  identifier,
  isoDate,
  positiveDecimal,
  transactionLines,
  type OperationalSchema,
} from "./operational.js"

export const inventorySchemas: Record<string, OperationalSchema> = {
  items: z.object({
    name: z.string().min(1),
    sku: z.string().min(1),
    type: z.enum(["inventory", "non-inventory", "service", "assembly"]),
    salesPrice: decimalString.default("0"),
    purchaseCost: decimalString.default("0"),
    incomeAccountId: identifier.optional(),
    expenseAccountId: identifier.optional(),
    inventoryAccountId: identifier.optional(),
  }).passthrough(),
  warehouses: z.object({ name: z.string().min(1), code: z.string().min(1) }).passthrough(),
  "stock-levels": z.object({
    itemId: identifier,
    warehouseId: identifier,
    quantity: decimalString,
    availableQuantity: decimalString.optional(),
  }).passthrough(),
  transfers: z.object({
    fromWarehouseId: identifier,
    toWarehouseId: identifier,
    transferDate: isoDate,
    lines: transactionLines,
  }).passthrough().refine((value) => value.fromWarehouseId !== value.toWarehouseId, {
    message: "Source and destination warehouses must be different",
  }),
  adjustments: z.object({
    adjustmentType: z.enum(["quantity", "value", "quantity-and-value"]),
    adjustmentDate: isoDate,
    adjustmentAccount: identifier,
    warehouse: identifier,
    lines: transactionLines,
  }).passthrough(),
  "stock-counts": z.object({
    warehouseId: identifier,
    countDate: isoDate,
    lines: z.array(z.object({
      itemId: identifier,
      countedQuantity: decimalString,
    })).default([]),
  }).passthrough(),
  assemblies: z.object({
    itemId: identifier,
    buildDate: isoDate,
    quantity: positiveDecimal,
    warehouseId: identifier,
    components: transactionLines,
  }).passthrough(),
  "lots-serials": z.object({
    item: identifier,
    trackingType: z.enum(["lot", "serial"]),
    lotSerial: z.string().min(1),
    warehouse: identifier,
    quantity: positiveDecimal,
    expiryDate: isoDate.optional(),
  }).passthrough(),
  "reorder-planning": z.object({
    warehouse: identifier,
    asOfDate: isoDate,
    horizon: z.number().int().positive().max(365),
    suggestions: z.array(z.record(z.unknown())).default([]),
  }).passthrough(),
  fulfillment: z.object({
    salesOrder: identifier,
    warehouse: identifier,
    shipDate: isoDate.optional(),
    lines: transactionLines,
  }).passthrough(),
  "landed-costs": z.object({
    shipment: identifier,
    costVendor: identifier,
    allocationDate: isoDate,
    costType: z.string().min(1),
    amount: positiveDecimal,
    allocationMethod: z.enum(["quantity", "value", "weight", "volume"]),
  }).passthrough(),
}

export const fulfillmentActionSchema = z.object({
  action: z.enum(["allocate", "pick", "pack", "ship"]),
  occurredAt: z.string().datetime().optional(),
  trackingNumber: z.string().optional(),
})
