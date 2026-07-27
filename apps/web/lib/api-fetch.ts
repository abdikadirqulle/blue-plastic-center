import { authService } from "@/features/auth/auth-service"

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const method = init.method ?? "GET"
  return fetch(input, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(!["GET", "HEAD", "OPTIONS"].includes(method)
        ? { "X-CSRF-Token": authService.csrfToken() ?? "" }
        : {}),
      ...init.headers,
    },
  })
}
