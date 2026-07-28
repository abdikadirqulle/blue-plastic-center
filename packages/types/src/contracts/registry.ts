import { accountingSchemas } from "./accounting.js";
import { bankingSchemas } from "./banking.js";
import { inventorySchemas } from "./inventory.js";
import { payrollSchemas } from "./payroll.js";
import { projectSchemas } from "./projects.js";
import { purchasingSchemas } from "./purchasing.js";
import { salesSchemas } from "./sales.js";
import { z } from "zod";

export const operationalSchemas = {
  sales: salesSchemas,
  purchasing: purchasingSchemas,
  inventory: inventorySchemas,
  banking: bankingSchemas,
  accounting: accountingSchemas,
  projects: projectSchemas,
  payroll: payrollSchemas,
} as const;

export type OperationalModule = keyof typeof operationalSchemas;
export const draftResourceDataSchema = z.record(z.unknown());

export function getOperationalSchema(moduleName: string, resourceName: string) {
  const moduleSchemas = operationalSchemas[moduleName as OperationalModule];
  return moduleSchemas?.[resourceName];
}

export function validateOperationalData(
  moduleName: string,
  resourceName: string,
  data: Record<string, unknown>,
  options: { partial?: boolean } = {},
) {
  if (options.partial) return draftResourceDataSchema.parse(data);
  const schema = getOperationalSchema(moduleName, resourceName);
  return schema ? schema.parse(data) : data;
}
