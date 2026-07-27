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
