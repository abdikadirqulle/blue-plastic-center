import { and, eq } from "drizzle-orm"
import type { DatabaseTransaction } from "../../db/client.js"
import { accounts } from "../../db/schema.js"
import { conflict, notFound, validation } from "../../platform/errors.js"
import {
  isSystemAccountKey,
  type SystemAccountKey,
} from "./system-accounts.js"

export interface ResolvedAccount {
  id: string
  companyId: string
  accountNumber: string
  name: string
  systemKey: string | null
  active: boolean
  isControlAccount: boolean
  allowManualPosting: boolean
}

export interface AccountLookup {
  findByMeaning(companyId: string, meaning: SystemAccountKey): Promise<ResolvedAccount | undefined>
  findById(companyId: string, accountId: string): Promise<ResolvedAccount | undefined>
  findByNumber(companyId: string, accountNumber: string): Promise<ResolvedAccount | undefined>
}

function requireActiveCompanyAccount(
  account: ResolvedAccount | undefined,
  companyId: string,
  reference: string,
) {
  if (!account || account.companyId !== companyId) {
    throw notFound(`Ledger account ${reference} was not found in this company`)
  }
  if (!account.active) throw conflict(`Ledger account ${reference} is inactive`)
  return account
}

export class AccountResolver {
  constructor(private readonly lookup: AccountLookup) {}

  async resolveMeaning(companyId: string, meaning: string) {
    if (!isSystemAccountKey(meaning)) {
      throw validation(`Unknown accounting meaning: ${meaning}`)
    }
    const account = requireActiveCompanyAccount(
      await this.lookup.findByMeaning(companyId, meaning),
      companyId,
      meaning,
    )
    if (account.systemKey !== meaning) {
      throw conflict(`Ledger account ${account.id} is not configured for ${meaning}`)
    }
    return account
  }

  async validateExplicitAccount(companyId: string, accountId: string) {
    return requireActiveCompanyAccount(
      await this.lookup.findById(companyId, accountId),
      companyId,
      accountId,
    )
  }

  /** Transitional compatibility for existing manual and legacy callers only. */
  async resolveLegacyAccountNumber(companyId: string, accountNumber: string) {
    return requireActiveCompanyAccount(
      await this.lookup.findByNumber(companyId, accountNumber),
      companyId,
      accountNumber,
    )
  }

  assertManualPostingAllowed(account: ResolvedAccount) {
    if (account.isControlAccount || !account.allowManualPosting) {
      throw conflict(`Ledger account ${account.accountNumber} does not allow manual posting`)
    }
  }
}

const accountSelection = {
  id: accounts.id,
  companyId: accounts.companyId,
  accountNumber: accounts.accountNumber,
  name: accounts.name,
  systemKey: accounts.systemKey,
  active: accounts.active,
  isControlAccount: accounts.isControlAccount,
  allowManualPosting: accounts.allowManualPosting,
}

export function createPostgresAccountResolver(transaction: DatabaseTransaction) {
  const find = async (
    companyId: string,
    reference: ReturnType<typeof eq>,
  ) => {
    const [account] = await transaction
      .select(accountSelection)
      .from(accounts)
      .where(and(eq(accounts.companyId, companyId), reference))
      .limit(1)
    return account
  }

  return new AccountResolver({
    findByMeaning: (companyId, meaning) =>
      find(companyId, eq(accounts.systemKey, meaning)),
    findById: (companyId, accountId) =>
      find(companyId, eq(accounts.id, accountId)),
    findByNumber: (companyId, accountNumber) =>
      find(companyId, eq(accounts.accountNumber, accountNumber)),
  })
}
