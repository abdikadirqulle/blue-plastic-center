import { randomUUID } from "node:crypto"
import { hashPassword } from "./password.js"
import type { IdentityRepository, IdentitySession, IdentityUser } from "./identity-repository.js"

export class MemoryIdentityRepository implements IdentityRepository {
  private readonly users: IdentityUser[] = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      companyId: "00000000-0000-4000-8000-000000000001",
      defaultBranchId: "00000000-0000-4000-8000-000000000011",
      username: "admin",
      email: "admin@blueplastic.local",
      displayName: "Abdisalam Abdulahi",
      role: "administrator",
      passwordHash: hashPassword("Admin123!"),
      active: true,
      failedLoginAttempts: 0,
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      companyId: "00000000-0000-4000-8000-000000000001",
      defaultBranchId: "00000000-0000-4000-8000-000000000011",
      username: "viewer",
      email: "viewer@blueplastic.local",
      displayName: "Read Only User",
      role: "viewer",
      passwordHash: hashPassword("Viewer123!"),
      active: true,
      failedLoginAttempts: 0,
    },
  ]

  private readonly sessions = new Map<string, IdentitySession>()

  async findUserByEmail(email: string) {
    return this.users.find((user) => user.email === email.toLowerCase())
  }

  async findUserByUsername(username: string) {
    return this.users.find((user) => user.username === username.toLowerCase())
  }

  async findUserById(userId: string, companyId: string) {
    return this.users.find(
      (user) => user.id === userId && user.companyId === companyId,
    )
  }

  async findUserBySessionHash(tokenHash: string) {
    const session = this.sessions.get(tokenHash)
    if (!session || session.expiresAt <= new Date()) return undefined
    return this.users.find((user) => user.id === session.userId)
  }

  async recordLoginFailure(userId: string, failedAttempts: number, lockedUntil?: Date) {
    const user = this.users.find((candidate) => candidate.id === userId)
    if (user) Object.assign(user, { failedLoginAttempts: failedAttempts, lockedUntil })
  }

  async recordLoginSuccess(userId: string) {
    const user = this.users.find((candidate) => candidate.id === userId)
    if (user) Object.assign(user, { failedLoginAttempts: 0, lockedUntil: undefined })
  }

  async createSession(session: IdentitySession) {
    this.sessions.set(session.tokenHash, { ...session, id: session.id || randomUUID() })
  }

  async deleteSession(tokenHash: string) {
    this.sessions.delete(tokenHash)
  }

  async sessionMatchesCsrf(tokenHash: string, csrfTokenHash: string) {
    const session = this.sessions.get(tokenHash)
    return Boolean(session && session.expiresAt > new Date() && session.csrfTokenHash === csrfTokenHash)
  }

  async updateSessionCsrf(tokenHash: string, csrfTokenHash: string) {
    const session = this.sessions.get(tokenHash)
    if (!session || session.expiresAt <= new Date()) return false
    session.csrfTokenHash = csrfTokenHash
    return true
  }

  async listUsers(companyId: string) {
    return this.users.filter((user) => user.companyId === companyId)
  }

  async createUser(user: IdentityUser) {
    this.users.push(user)
  }

  async updateUser(
    userId: string,
    companyId: string,
    changes: Partial<Pick<IdentityUser, "username" | "email" | "displayName" | "role" | "active">>,
  ) {
    const user = this.users.find(
      (candidate) => candidate.id === userId && candidate.companyId === companyId,
    )
    if (!user) return undefined
    Object.assign(user, changes)
    return user
  }

  async updateUserPassword(userId: string, passwordHash: string) {
    const user = this.users.find((candidate) => candidate.id === userId)
    if (user) user.passwordHash = passwordHash
  }
}
