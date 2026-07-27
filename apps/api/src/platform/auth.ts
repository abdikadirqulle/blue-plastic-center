import type { Action, Principal, Role } from "./types.js"
import { forbidden } from "./errors.js"

const grants: Record<Role, Action[]> = {
  administrator: ["read", "create", "update", "delete", "post", "approve"],
  finance_manager: ["read", "create", "update", "delete", "post", "approve"],
  accountant: ["read", "create", "update", "post"],
  sales: ["read", "create", "update"],
  purchasing: ["read", "create", "update", "approve"],
  warehouse: ["read", "create", "update"],
  payroll: ["read", "create", "update", "approve"],
  viewer: ["read"],
}

export function authorize(principal: Principal, action: Action) {
  if (!grants[principal.role].includes(action)) throw forbidden()
}

const moduleRoles: Partial<Record<Role, string[]>> = {
  sales: ["sales", "debts"],
  purchasing: ["purchasing"],
  warehouse: ["inventory"],
  payroll: ["payroll"],
}

export function authorizeResource(principal: Principal, action: Action, moduleName: string) {
  authorize(principal, action)
  const allowedModules = moduleRoles[principal.role]
  if (allowedModules && !allowedModules.includes(moduleName)) throw forbidden()
}
