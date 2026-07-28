export interface ApiEnvelope<T> {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiRecord<
  TData extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  module: string;
  resource: string;
  companyId: string;
  branchId: string;
  status: string;
  version: number;
  data: TData;
  createdAt: string;
  updatedAt: string;
  isDeleted: boolean;
  deletedAt?: string;
}

export interface ResourceParams {
  module: string;
  resource: string;
  id: string;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}
