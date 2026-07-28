import { describe, expect, it } from "vitest"
import { hashPassword, verifyPassword } from "../../src/modules/auth/password.js"

describe("password security", () => {
  it("hashes with a unique salt and never stores plaintext", () => {
    const first = hashPassword("SecurePassword123!")
    const second = hashPassword("SecurePassword123!")

    expect(first).toMatch(/^scrypt:[a-f0-9]{32}:[a-f0-9]+$/)
    expect(first).not.toContain("SecurePassword123!")
    expect(second).not.toBe(first)
  })

  it("accepts only the matching password and a valid hash format", () => {
    const stored = hashPassword("SecurePassword123!")

    expect(verifyPassword("SecurePassword123!", stored)).toBe(true)
    expect(verifyPassword("WrongPassword123!", stored)).toBe(false)
    expect(verifyPassword("SecurePassword123!", "invalid")).toBe(false)
  })
})
