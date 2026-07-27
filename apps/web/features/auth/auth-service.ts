import { webEnv } from "@/lib/env"

const csrfKey = "blue-plastic-csrf"

export const authService = {
  async login(email: string, password: string) {
    let response: Response
    try {
      response = await fetch(`${webEnv.apiUrl}/v1/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
    } catch {
      throw new Error(
        `Cannot connect to the API at ${webEnv.apiUrl}. Start the API and verify VITE_API_URL/CORS settings.`,
      )
    }
    const payload = await response.json() as {
      data?: { csrfToken: string }
      error?: { message?: string }
    }
    if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Unable to sign in")
    sessionStorage.setItem(csrfKey, payload.data.csrfToken)
  },
  async me() {
    let response: Response
    try {
      response = await fetch(`${webEnv.apiUrl}/v1/auth/me`, {
        credentials: "include",
      })
    } catch {
      throw new Error(`Cannot connect to the API at ${webEnv.apiUrl}`)
    }
    if (!response.ok) throw new Error("Session expired")
    return response.json() as Promise<{
      data: {
        user: { id: string; displayName: string; email: string; role: string }
        company: { id: string; legalName: string }
        branch: { id: string; name: string }
      }
    }>
  },
  async logout() {
    await fetch(`${webEnv.apiUrl}/v1/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: { "X-CSRF-Token": sessionStorage.getItem(csrfKey) ?? "" },
    })
    sessionStorage.removeItem(csrfKey)
  },
  csrfToken: () => sessionStorage.getItem(csrfKey),
  clear: () => sessionStorage.removeItem(csrfKey),
}
