import type { Role } from "../../platform/types.js"

export interface IdentityUser {
  id: string
  companyId: string
  defaultBranchId: string
  username: string
  email: string
  displayName: string
  role: Role
  passwordHash: string
  active: boolean
  failedLoginAttempts: number
  lockedUntil?: Date
}

export interface IdentitySession {
  id: string
  userId: string
  tokenHash: string
  csrfTokenHash: string
  expiresAt: Date
}

export interface IdentityRepository {
  findUserByUsername(username: string): Promise<IdentityUser | undefined>
  findUserByEmail(email: string): Promise<IdentityUser | undefined>
  findUserById(userId: string, companyId: string): Promise<IdentityUser | undefined>
  findUserBySessionHash(tokenHash: string): Promise<IdentityUser | undefined>
  recordLoginFailure(userId: string, failedAttempts: number, lockedUntil?: Date): Promise<void>
  recordLoginSuccess(userId: string): Promise<void>
  createSession(session: IdentitySession & { userAgent?: string; ipAddress?: string }): Promise<void>
  deleteSession(tokenHash: string): Promise<void>
  sessionMatchesCsrf(tokenHash: string, csrfTokenHash: string): Promise<boolean>
  /** Replace the CSRF secret for an active session (used after page reload). */
  updateSessionCsrf(tokenHash: string, csrfTokenHash: string): Promise<boolean>
  listUsers(companyId: string): Promise<IdentityUser[]>
  createUser(user: IdentityUser): Promise<void>
  updateUser(
    userId: string,
    companyId: string,
    changes: Partial<Pick<IdentityUser, "username" | "email" | "displayName" | "role" | "active">>,
  ): Promise<IdentityUser | undefined>
  updateUserPassword(userId: string, passwordHash: string): Promise<void>
}
