export type CurrencyCode = "USD" | "SOS" | "EUR" | "GBP";

export interface Money {
  amount: string;
  currency: CurrencyCode;
}

export interface CompanyContext {
  companyId: string;
  branchId: string;
  currency: CurrencyCode;
}

export type DocumentStatus =
  | "draft"
  | "pending"
  | "approved"
  | "posted"
  | "paid"
  | "overdue"
  | "void";

export * from "./contracts/account-types.js";
export * from "./contracts/operational.js";
export * from "./contracts/sales.js";
export * from "./contracts/purchasing.js";
export * from "./contracts/inventory.js";
export * from "./contracts/banking.js";
export * from "./contracts/accounting.js";
export * from "./contracts/projects.js";
export * from "./contracts/payroll.js";
export * from "./contracts/registry.js";
export * from "./contracts/activity.js";
export * from "./forms.js";
export * from "./api.js";
export * from "./mvp-scope.js";
