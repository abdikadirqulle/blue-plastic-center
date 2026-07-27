import { webEnv } from "@/lib/env";

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
}

export class ApiClient {
  constructor(
    private readonly baseUrl = webEnv.apiUrl,
    private readonly getAccessToken: () => string | undefined = () => undefined,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = this.getAccessToken();
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: { message: response.statusText } })) as { error?: { message?: string } };
      throw new Error(body.error?.message ?? "API request failed");
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

  update<TData extends Record<string, unknown>>(moduleName: string, resource: string, id: string, data: Partial<TData>, version: number) {
    return this.request<ApiEnvelope<ApiRecord<TData>>>(`/v1/${moduleName}/${resource}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ data, version }),
    });
  }

  remove(moduleName: string, resource: string, id: string) {
    return this.request<void>(`/v1/${moduleName}/${resource}/${id}`, { method: "DELETE" });
  }
}

export const apiClient = new ApiClient();
