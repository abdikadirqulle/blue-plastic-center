import { webEnv } from "@/lib/env";
import { authService } from "@/features/auth/auth-service";

export interface ApiEnvelope<T> {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiRecord<TData extends Record<string, unknown> = Record<string, unknown>> {
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

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

export class ApiClient {
  constructor(
    private readonly baseUrl = webEnv.apiUrl,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.method && !["GET", "HEAD"].includes(init.method)
          ? { "X-CSRF-Token": authService.csrfToken() ?? "" }
          : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({
        error: { message: response.statusText },
      })) as {
        error?: { message?: string; code?: string; details?: unknown }
      };
      if (response.status === 401 && window.location.pathname !== "/login") {
        authService.clear()
        window.location.assign("/login")
      }
      throw new ApiError(
        body.error?.message ?? "API request failed",
        response.status,
        body.error?.code,
        body.error?.details,
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  list<TData extends Record<string, unknown>>(moduleName: string, resource: string, query = "") {
    return this.request<ApiEnvelope<ApiRecord<TData>[]>>(`/v1/${moduleName}/${resource}${query ? `?${query}` : ""}`);
  }

  get<TData extends Record<string, unknown>>(moduleName: string, resource: string, id: string) {
    return this.request<ApiEnvelope<ApiRecord<TData>>>(`/v1/${moduleName}/${resource}/${id}`);
  }

  create<TData extends Record<string, unknown>>(moduleName: string, resource: string, data: TData, status = "draft") {
    return this.request<ApiEnvelope<ApiRecord<TData>>>(`/v1/${moduleName}/${resource}`, {
      method: "POST",
      body: JSON.stringify({ data, status }),
    });
  }

  update<TData extends Record<string, unknown>>(
    moduleName: string,
    resource: string,
    id: string,
    data: Partial<TData>,
    version: number,
    status?: string,
  ) {
    return this.request<ApiEnvelope<ApiRecord<TData>>>(`/v1/${moduleName}/${resource}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ data, version, ...(status ? { status } : {}) }),
    });
  }

  remove(moduleName: string, resource: string, id: string) {
    return this.request<void>(`/v1/${moduleName}/${resource}/${id}`, { method: "DELETE" });
  }

  action<T>(
    path: string,
    body?: Record<string, unknown>,
    method = "POST",
  ) {
    return this.request<ApiEnvelope<T>>(path, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
  }

  listTrash(query = "") {
    return this.request<ApiEnvelope<ApiRecord[]>>(
      `/v1/trash${query ? `?${query}` : ""}`,
    )
  }

  restore(id: string) {
    return this.request<ApiEnvelope<ApiRecord>>(
      `/v1/trash/${encodeURIComponent(id)}/restore`,
      { method: "POST" },
    )
  }
}

export const apiClient = new ApiClient();
