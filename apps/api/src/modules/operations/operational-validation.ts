import { bankingSchemas } from "../banking/banking.schemas.js"
import { inventorySchemas } from "../inventory/inventory.schemas.js"
import { purchasingSchemas } from "../purchasing/purchasing.schemas.js"
import { salesSchemas } from "../sales/sales.schemas.js"

const schemas = {
  sales: salesSchemas,
  purchasing: purchasingSchemas,
  inventory: inventorySchemas,
  banking: bankingSchemas,
} as const

export function validateOperationalData(
  moduleName: string,
  resourceName: string,
  data: Record<string, unknown>,
) {
  const moduleSchemas = schemas[moduleName as keyof typeof schemas]
  const schema = moduleSchemas?.[resourceName]
  return schema ? schema.parse(data) : data
}
