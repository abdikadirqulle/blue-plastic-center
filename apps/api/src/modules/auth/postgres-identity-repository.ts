import { and, eq, gt } from "drizzle-orm"
import type { Database } from "../../db/client.js"
import { branches, sessions, users } from "../../db/schema.js"
import type { Role } from "../../platform/types.js"
import type {
  IdentityRepository,
  IdentitySession,
  IdentityUser,
} from "./identity-repository.js"

export class PostgresIdentityRepository implements IdentityRepository {
  constructor(private readonly db: Database) {}

  private async toIdentityUser(
    user: typeof users.$inferSelect,
  ): Promise<IdentityUser | undefined> {
    if (!user.companyId || !user.passwordHash) return undefined
    const [branch] = await this.db
      .select({ id: branches.id })
      .from(branches)
      .where(
        and(eq(branches.companyId, user.companyId), eq(branches.active, true)),
      )
      .limit(1)
    if (!branch) return undefined
    return {
      id: user.id,
      companyId: user.companyId,
      defaultBranchId: branch.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role as Role,
      passwordHash: user.passwordHash,
      active: user.active,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil ?? undefined,
    }
  }

  async findUserByEmail(email: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)
    return user ? this.toIdentityUser(user) : undefined
  }

  async findUserByUsername(username: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username.toLowerCase()))
      .limit(1)
    return user ? this.toIdentityUser(user) : undefined
  }

  async findUserById(userId: string, companyId: string) {
    const [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, userId), eq(users.companyId, companyId)))
      .limit(1)
    return user ? this.toIdentityUser(user) : undefined
  }

  async findUserBySessionHash(tokenHash: string) {
    const [row] = await this.db
      .select({ user: users })
      .from(sessions)
      .innerJoin(users, eq(sessions.userId, users.id))
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1)
    return row ? this.toIdentityUser(row.user) : undefined
  }

  async recordLoginFailure(
    userId: string,
    failedLoginAttempts: number,
    lockedUntil?: Date,
  ) {
    await this.db
      .update(users)
      .set({ failedLoginAttempts, lockedUntil })
      .where(eq(users.id, userId))
  }

  async recordLoginSuccess(userId: string) {
    await this.db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      })
      .where(eq(users.id, userId))
  }

  async createSession(
    session: IdentitySession & { userAgent?: string; ipAddress?: string },
  ) {
    await this.db.insert(sessions).values(session)
  }

  async deleteSession(tokenHash: string) {
    await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash))
  }

  async sessionMatchesCsrf(tokenHash: string, csrfTokenHash: string) {
    const [session] = await this.db
      .select({ id: sessions.id })
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, tokenHash),
          eq(sessions.csrfTokenHash, csrfTokenHash),
          gt(sessions.expiresAt, new Date()),
        ),
      )
      .limit(1)
    return Boolean(session)
  }

  async updateSessionCsrf(tokenHash: string, csrfTokenHash: string) {
    const updated = await this.db
      .update(sessions)
      .set({ csrfTokenHash })
      .where(
        and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())),
      )
      .returning({ id: sessions.id })
    return Boolean(updated[0])
  }

  async listUsers(companyId: string) {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.companyId, companyId))
    const identities = await Promise.all(
      rows.map((user) => this.toIdentityUser(user)),
    )
    return identities.filter((user): user is IdentityUser => Boolean(user))
  }

  async createUser(user: IdentityUser) {
    await this.db.insert(users).values({
      id: user.id,
      companyId: user.companyId,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      passwordHash: user.passwordHash,
      active: user.active,
    })
  }

  async updateUser(
    userId: string,
    companyId: string,
    changes: Partial<Pick<IdentityUser, "username" | "email" | "displayName" | "role" | "active">>,
  ) {
    const [updated] = await this.db
      .update(users)
      .set({
        ...changes,
        ...(changes.username ? { username: changes.username.toLowerCase() } : {}),
        ...(changes.email ? { email: changes.email.toLowerCase() } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(users.id, userId), eq(users.companyId, companyId)))
      .returning()
    return updated ? this.toIdentityUser(updated) : undefined
  }

  async updateUserPassword(userId: string, passwordHash: string) {
    await this.db
      .update(users)
      .set({
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, userId))
    await this.db.delete(sessions).where(eq(sessions.userId, userId))
  }
}
