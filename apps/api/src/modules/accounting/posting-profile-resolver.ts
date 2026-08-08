import { and, asc, eq } from "drizzle-orm"
import type { DatabaseTransaction } from "../../db/client.js"
import { postingProfileLines, postingProfiles } from "../../db/schema.js"
import { conflict, notFound, validation } from "../../platform/errors.js"
import { AccountResolver, createPostgresAccountResolver } from "./account-resolver.js"
import {
  isPostingEvent,
  isPostingOverrideSource,
  isPostingRole,
  validatePostingProfile,
  type PostingEvent,
  type PostingOverrideSource,
  type PostingProfileDefinition,
  type PostingRole,
  type PostingSide,
} from "./posting-profiles.js"
import { isSystemAccountKey, type SystemAccountKey } from "./system-accounts.js"

export interface PostingProfileLookup {
  find(companyId: string, event: PostingEvent): Promise<PostingProfileDefinition | undefined>
}

export interface ResolvedPostingProfileLine {
  role: PostingRole
  side: PostingSide
  accountId: string
  resolution: "meaning" | "configured_override"
}

export class PostingProfileResolver {
  constructor(
    private readonly lookup: PostingProfileLookup,
    private readonly accounts: AccountResolver,
  ) {}

  async resolve(
    companyId: string,
    event: string,
    overrides: Partial<Record<PostingOverrideSource, string>> = {},
  ) {
    if (!isPostingEvent(event)) throw validation(`Unknown posting event: ${event}`)
    const profile = await this.lookup.find(companyId, event)
    if (!profile || profile.companyId !== companyId) {
      throw notFound(`Active posting profile ${event} was not found in this company`)
    }
    try {
      validatePostingProfile(profile)
    } catch (error) {
      throw conflict(error instanceof Error ? error.message : `Posting profile ${event} is invalid`)
    }

    const lines: ResolvedPostingProfileLine[] = []
    for (const line of [...profile.lines].sort((left, right) => left.lineNumber - right.lineNumber)) {
      const overrideId = line.overrideSource ? overrides[line.overrideSource] : undefined
      if (overrideId) {
        const account = await this.accounts.validateExplicitAccount(companyId, overrideId)
        lines.push({
          role: line.role,
          side: line.side,
          accountId: account.id,
          resolution: "configured_override",
        })
        continue
      }
      if (!line.accountMeaning) {
        throw conflict(
          `Posting role ${line.role} requires configured ${line.overrideSource}`,
        )
      }
      const account = await this.accounts.resolveMeaning(companyId, line.accountMeaning)
      lines.push({
        role: line.role,
        side: line.side,
        accountId: account.id,
        resolution: "meaning",
      })
    }
    return { ...profile, lines }
  }
}

export function createPostgresPostingProfileResolver(transaction: DatabaseTransaction) {
  const lookup: PostingProfileLookup = {
    async find(companyId, event) {
      const [profile] = await transaction
        .select()
        .from(postingProfiles)
        .where(and(
          eq(postingProfiles.companyId, companyId),
          eq(postingProfiles.code, event),
        ))
        .limit(1)
      if (!profile) return undefined
      const rows = await transaction
        .select()
        .from(postingProfileLines)
        .where(eq(postingProfileLines.profileId, profile.id))
        .orderBy(asc(postingProfileLines.lineNumber))
      const lines = rows.map((line) => {
        if (!isPostingRole(line.role)) throw conflict(`Unknown posting role: ${line.role}`)
        if (line.side !== "debit" && line.side !== "credit") {
          throw conflict(`Posting role ${line.role} has an invalid side`)
        }
        if (line.accountMeaning && !isSystemAccountKey(line.accountMeaning)) {
          throw conflict(`Posting role ${line.role} has an unknown account meaning`)
        }
        if (line.overrideSource && !isPostingOverrideSource(line.overrideSource)) {
          throw conflict(`Posting role ${line.role} has an unknown override source`)
        }
        return {
          id: line.id,
          role: line.role,
          side: line.side as PostingSide,
          accountMeaning: (line.accountMeaning ?? undefined) as SystemAccountKey | undefined,
          overrideSource: (line.overrideSource ?? undefined) as PostingOverrideSource | undefined,
          lineNumber: line.lineNumber,
        }
      })
      return {
        id: profile.id,
        companyId: profile.companyId,
        code: event,
        name: profile.name,
        active: profile.active,
        version: profile.version,
        lines,
      }
    },
  }
  return new PostingProfileResolver(lookup, createPostgresAccountResolver(transaction))
}
