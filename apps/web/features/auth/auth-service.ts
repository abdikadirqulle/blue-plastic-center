import { webEnv } from "@/lib/env"

const csrfKey = "blue-plastic-csrf"

export const authService = {
  async login(email: string, password: string) {
    const response = await fetch(`${webEnv.apiUrl}/v1/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    const payload = await response.json() as {
      data?: { csrfToken: string }
      error?: { message?: string }
    }
    if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Unable to sign in")
    sessionStorage.setItem(csrfKey, payload.data.csrfToken)
  },
  csrfToken: () => sessionStorage.getItem(csrfKey),
  clear: () => sessionStorage.removeItem(csrfKey),
}
