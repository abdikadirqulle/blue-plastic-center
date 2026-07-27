export type Role = "administrator" | "finance_manager" | "accountant" | "sales" | "purchasing" | "warehouse" | "payroll" | "viewer";
export type Action = "read" | "create" | "update" | "delete" | "post" | "approve";

export interface Principal {
  userId: string;
  name: string;
  role: Role;
}

export interface RequestContext {
  requestId: string;
  companyId: string;
  branchId: string;
  principal: Principal;
}

export interface ResourceRecord {
  id: string;
  module: string;
  resource: string;
  companyId: string;
  branchId: string;
  status: string;
  version: number;
  data: Record<string, unknown>;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  isDeleted: boolean;
  deletedAt?: string;
}

export interface AuditEvent {
  id: string;
  requestId: string;
  companyId: string;
  branchId: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  changes?: Record<string, unknown>;
}

export interface ListQuery {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  sort?: "createdAt" | "updatedAt";
  order?: "asc" | "desc";
}

export interface TrashQuery extends ListQuery {
  module?: string;
  resource?: string;
}
