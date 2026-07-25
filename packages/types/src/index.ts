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
