import { bankingSchemas } from "../banking/banking.schemas.js"
import { inventorySchemas } from "../inventory/inventory.schemas.js"
import { purchasingSchemas } from "../purchasing/purchasing.schemas.js"
import { salesSchemas } from "../sales/sales.schemas.js"
import { accountingSchemas } from "../accounting/accounting.schemas.js"
import { projectSchemas } from "../projects/project.schemas.js"
import { payrollSchemas } from "../payroll/payroll.schemas.js"

const schemas = {
  sales: salesSchemas,
  purchasing: purchasingSchemas,
  inventory: inventorySchemas,
  banking: bankingSchemas,
  accounting: accountingSchemas,
  projects: projectSchemas,
  payroll: payrollSchemas,
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
