import { webEnv } from "@/lib/env";
import { authService } from "@/features/auth/auth-service";
import type { ApiEnvelope, ApiErrorPayload, ApiRecord } from "@blue-plastic/types";
export type { ApiEnvelope, ApiRecord } from "@blue-plastic/types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly details?: unknown,
    readonly requestId?: string,
  ) {
    super(message)
  }
}

function validationMessage(
  fallback: string,
  details: unknown,
) {
  if (!details || typeof details !== "object") return fallback
  const flattened = details as {
    fieldErrors?: Record<string, string[]>
    formErrors?: string[]
  }
  const messages = [
    ...(flattened.formErrors ?? []),
    ...Object.entries(flattened.fieldErrors ?? {}).flatMap(([field, errors]) =>
      errors.map((message) => `${field}: ${message}`),
    ),
  ]
  return messages.length ? messages.join(" · ") : fallback
}

export class ApiClient {
  constructor(
    private readonly baseUrl = webEnv.apiUrl,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let response: Response
    try {
      response = await fetch(`${this.baseUrl}${path}`, {
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
    } catch {
      throw new ApiError(
        `Cannot connect to the API at ${this.baseUrl}. Check that the backend is running and the frontend origin is allowed.`,
        0,
        "NETWORK_ERROR",
      )
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({
        error: { message: response.statusText },
      })) as Partial<ApiErrorPayload>;
      const requestId = body.error?.requestId ?? response.headers.get("X-Request-Id") ?? undefined;
      if (response.status === 401 && window.location.pathname !== "/login") {
        authService.clear()
        window.location.assign("/login")
      }
      const message = validationMessage(body.error?.message ?? "API request failed", body.error?.details);
      console.error("[API_REQUEST_FAILED]", {
        requestId,
        method: init?.method ?? "GET",
        path,
        status: response.status,
        code: body.error?.code,
        message,
        details: body.error?.details,
      });
      throw new ApiError(
        `${message}${requestId ? ` · Ref: ${requestId.slice(0, 8)}` : ""}`,
        response.status,
        body.error?.code,
        body.error?.details,
        requestId,
      );
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  list<TData extends Record<string, unknown>>(moduleName: string, resource: string, query = "") {
    return this.request<ApiEnvelope<ApiRecord<TData>[]>>(`/v1/${moduleName}/${resource}${query ? `?${query}` : ""}`);
  }

  get<TData extends Record<string, unknown>>(moduleName: string, resource: string, id: string) {
    return this.request<ApiEnvelope<ApiRecord<TData>>>(
      `/v1/${moduleName}/${resource}/${encodeURIComponent(id)}`,
    );
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
    return this.request<ApiEnvelope<ApiRecord<TData>>>(
      `/v1/${moduleName}/${resource}/${encodeURIComponent(id)}`,
      {
      method: "PATCH",
      body: JSON.stringify({ data, version, ...(status ? { status } : {}) }),
      },
    );
  }

  remove(moduleName: string, resource: string, id: string) {
    return this.request<void>(
      `/v1/${moduleName}/${resource}/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
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

  getPath<T>(path: string) {
    return this.request<ApiEnvelope<T>>(path)
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
