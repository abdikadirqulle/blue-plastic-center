export type SalesResource =
  | "invoices"
  | "customers"
  | "estimates"
  | "sales-orders"
  | "payments"
  | "credit-notes"
  | "sales-receipts"
  | "refund-receipts"
  | "statements"
  | "deposits"
  | "recurring-invoices";

export interface SalesRecord {
  id: string;
  resource: SalesResource;
  customer: string;
  amount: string;
  date: string;
  status: string;
  reference?: string;
  paymentMethod?: string;
  balance?: string;
  memo?: string;
  version?: number;
}

export interface SalesRecordInput {
  customer: string;
  amount: string;
  date: string;
  status?: string;
  reference?: string;
  paymentMethod?: string;
  memo?: string;
}

export interface SalesQuery {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
}

export interface SalesRepository {
  list(resource: SalesResource, query?: SalesQuery): Promise<SalesRecord[]>;
  get(resource: SalesResource, id: string): Promise<SalesRecord | null>;
  create(resource: SalesResource, input: SalesRecordInput): Promise<SalesRecord>;
  update(resource: SalesResource, id: string, input: Partial<SalesRecordInput>): Promise<SalesRecord>;
  remove(resource: SalesResource, id: string): Promise<void>;
}
