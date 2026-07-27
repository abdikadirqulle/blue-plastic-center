export type OperationsModule = "purchasing" | "inventory" | "banking";

export type OperationsResource =
  | "bills"
  | "vendors"
  | "purchase-orders"
  | "receipts"
  | "bill-payments"
  | "vendor-credits"
  | "expenses"
  | "checks"
  | "approvals"
  | "items"
  | "stock-levels"
  | "warehouses"
  | "transfers"
  | "stock-counts"
  | "assemblies"
  | "adjustments"
  | "lots-serials"
  | "reorder-planning"
  | "fulfillment"
  | "landed-costs"
  | "accounts"
  | "transactions"
  | "bank-feeds"
  | "bank-rules"
  | "reconciliation"
  | "deposits"
  | "cash-flow";

export interface OperationRecord {
  id: string;
  module: OperationsModule;
  resource: OperationsResource;
  name: string;
  secondary: string;
  amount: string;
  date: string;
  status: string;
  reference: string;
  meta: Record<string, string>;
}

export interface OperationsQuery {
  search?: string;
  status?: string;
  from?: string;
  to?: string;
}

export interface OperationRecordInput {
  name: string;
  secondary?: string;
  amount?: string;
  date?: string;
  status?: string;
  reference?: string;
  meta?: Record<string, string>;
}

export interface OperationsRepository {
  list(
    module: OperationsModule,
    resource: OperationsResource,
    query?: OperationsQuery,
  ): Promise<OperationRecord[]>;
  get(
    module: OperationsModule,
    resource: OperationsResource,
    id: string,
  ): Promise<OperationRecord | null>;
  create(
    module: OperationsModule,
    resource: OperationsResource,
    input: OperationRecordInput,
  ): Promise<OperationRecord>;
  update(
    module: OperationsModule,
    resource: OperationsResource,
    id: string,
    input: Partial<OperationRecordInput>,
  ): Promise<OperationRecord>;
  remove(
    module: OperationsModule,
    resource: OperationsResource,
    id: string,
  ): Promise<void>;
}
