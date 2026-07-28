import { createHash, randomBytes, randomUUID } from "node:crypto"
import { ApiError } from "../../platform/errors.js"
import type { Principal } from "../../platform/types.js"
import type { IdentityRepository, IdentityUser } from "./identity-repository.js"
import { hashPassword, verifyPassword } from "./password.js"

const digest = (value: string) => createHash("sha256").update(value).digest("hex")

export interface AuthenticatedIdentity {
  principal: Principal
  companyId: string
  branchId: string
}

export class AuthService {
  constructor(
    private readonly repository: IdentityRepository,
    private readonly sessionTtlHours: number,
  ) {}

  async login(username: string, password: string, metadata: { userAgent?: string; ipAddress?: string }) {
    const user = await this.repository.findUserByUsername(username.toLowerCase())
    if (!user || !user.active) throw new ApiError(401, "INVALID_CREDENTIALS", "Username or password is incorrect")
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiError(429, "ACCOUNT_LOCKED", "Account is temporarily locked")
    }
    if (!verifyPassword(password, user.passwordHash)) {
      const attempts = user.failedLoginAttempts + 1
      const lockedUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60_000) : undefined
      await this.repository.recordLoginFailure(user.id, attempts, lockedUntil)
      throw new ApiError(401, "INVALID_CREDENTIALS", "Username or password is incorrect")
    }

    const token = randomBytes(32).toString("base64url")
    const csrfToken = randomBytes(24).toString("base64url")
    await this.repository.createSession({
      id: randomUUID(),
      userId: user.id,
      tokenHash: digest(token),
      csrfTokenHash: digest(csrfToken),
      expiresAt: new Date(Date.now() + this.sessionTtlHours * 60 * 60_000),
      ...metadata,
    })
    await this.repository.recordLoginSuccess(user.id)
    return { token, csrfToken, user: this.publicUser(user) }
  }

  async authenticate(token?: string): Promise<AuthenticatedIdentity> {
    if (!token) throw new ApiError(401, "UNAUTHORIZED", "A valid session is required")
    const user = await this.repository.findUserBySessionHash(digest(token))
    if (!user || !user.active) throw new ApiError(401, "UNAUTHORIZED", "Session is invalid or expired")
    return {
      principal: this.publicUser(user),
      companyId: user.companyId,
      branchId: user.defaultBranchId,
    }
  }

  async verifyCsrf(token: string | undefined, csrfToken: string | undefined) {
    if (!token || !csrfToken || !await this.repository.sessionMatchesCsrf(digest(token), digest(csrfToken))) {
      throw new ApiError(403, "CSRF_INVALID", "CSRF token is missing or invalid")
    }
  }

  async logout(token?: string) {
    if (token) await this.repository.deleteSession(digest(token))
  }

  async getUser(userId: string, companyId: string) {
    const user = await this.repository.findUserById(userId, companyId)
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User was not found")
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      role: user.role,
      active: user.active,
    }
  }

  async listUsers(companyId: string) {
    return (await this.repository.listUsers(companyId)).map((user) => ({
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      username: user.username,
      email: user.email,
      active: user.active,
    }))
  }

  async createUser(input: {
    companyId: string
    branchId: string
    username: string
    email: string
    displayName: string
    role: IdentityUser["role"]
    password: string
  }) {
    const [existingUsername, existingEmail] = await Promise.all([
      this.repository.findUserByUsername(input.username),
      this.repository.findUserByEmail(input.email),
    ])
    if (existingUsername) throw new ApiError(409, "USERNAME_EXISTS", "This username is already in use")
    if (existingEmail) throw new ApiError(409, "EMAIL_EXISTS", "A user with this email already exists")
    const user: IdentityUser = {
      id: randomUUID(),
      companyId: input.companyId,
      defaultBranchId: input.branchId,
      username: input.username.toLowerCase(),
      email: input.email.toLowerCase(),
      displayName: input.displayName,
      role: input.role,
      passwordHash: hashPassword(input.password),
      active: true,
      failedLoginAttempts: 0,
    }
    await this.repository.createUser(user)
    return {
      id: user.id,
      displayName: user.displayName,
      role: user.role,
      username: user.username,
      email: user.email,
      active: user.active,
    }
  }

  async updateUser(
    userId: string,
    companyId: string,
    changes: Partial<Pick<IdentityUser, "username" | "email" | "displayName" | "role" | "active">>,
  ) {
    if (changes.username) {
      const existing = await this.repository.findUserByUsername(changes.username)
      if (existing && existing.id !== userId)
        throw new ApiError(409, "USERNAME_EXISTS", "This username is already in use")
    }
    if (changes.email) {
      const existing = await this.repository.findUserByEmail(changes.email)
      if (existing && existing.id !== userId)
        throw new ApiError(409, "EMAIL_EXISTS", "A user with this email already exists")
    }
    const user = await this.repository.updateUser(userId, companyId, changes)
    if (!user) throw new ApiError(404, "USER_NOT_FOUND", "User was not found")
    return {
      id: user.id,
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      role: user.role,
      active: user.active,
    }
  }

  async resetPassword(userId: string, password: string) {
    await this.repository.updateUserPassword(userId, hashPassword(password))
  }

  private publicUser(user: IdentityUser): Principal {
    return { userId: user.id, name: user.displayName, role: user.role }
  }
}
