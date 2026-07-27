import type { Action, Principal, Role } from "./types.js"
import { ApiError, forbidden } from "./errors.js"

const demoTokens: Record<string, Principal> = {
  "admin-demo-token": {
    userId: "00000000-0000-4000-8000-000000000001",
    name: "Abdisalam Abdulahi",
    role: "administrator",
  },
  "accountant-demo-token": {
    userId: "00000000-0000-4000-8000-000000000002",
    name: "Amina Yusuf",
    role: "accountant",
  },
  "viewer-demo-token": {
    userId: "00000000-0000-4000-8000-000000000003",
    name: "Read Only User",
    role: "viewer",
  },
}

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

export function authenticate(authorization?: string): Principal {
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : ""
  const principal = demoTokens[token]
  if (!principal)
    throw new ApiError(401, "UNAUTHORIZED", "A valid bearer token is required")
  return principal
}

export function authorize(principal: Principal, action: Action) {
  if (!grants[principal.role].includes(action)) throw forbidden()
}
