import "dotenv/config"
import { createDatabase } from "./client.js"
import { accounts, branches, companies, fiscalPeriods, users } from "./schema.js"
import { hashPassword } from "../modules/auth/password.js"

async function seed() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required to seed the database")
  const { db, close } = createDatabase(databaseUrl)

  await db
    .insert(companies)
    .values({
      id: "00000000-0000-4000-8000-000000000001",
      legalName: "BLUE PLASTIC CENTER",
      functionalCurrency: "USD",
    })
    .onConflictDoUpdate({
      target: companies.id,
      set: { legalName: "BLUE PLASTIC CENTER" },
    })

  await db
    .insert(branches)
    .values({
      id: "00000000-0000-4000-8000-000000000011",
      companyId: "00000000-0000-4000-8000-000000000001",
      name: "Main company",
      code: "MAIN",
    })
    .onConflictDoNothing()

  const seedUsers = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@blueplastic.local",
      displayName: "Abdisalam Abdulahi",
      role: "administrator",
      password: "Admin123!",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      email: "accountant@blueplastic.local",
      displayName: "Amina Yusuf",
      role: "accountant",
      password: "Accountant123!",
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      email: "viewer@blueplastic.local",
      displayName: "Read Only User",
      role: "viewer",
      password: "Viewer123!",
    },
  ] as const

  for (const user of seedUsers) {
    await db
      .insert(users)
      .values({
        id: user.id,
        companyId: "00000000-0000-4000-8000-000000000001",
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        passwordHash: hashPassword(user.password),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          companyId: "00000000-0000-4000-8000-000000000001",
          passwordHash: hashPassword(user.password),
        },
      })
  }

  const seedAccounts = [
    ["1000", "Cash and Bank", "asset"],
    ["1100", "Accounts Receivable", "asset"],
    ["1200", "Inventory", "asset"],
    ["2000", "Accounts Payable", "liability"],
    ["2100", "Payroll Payable", "liability"],
    ["3000", "Owner's Equity", "equity"],
    ["4000", "Sales Revenue", "income"],
    ["5000", "Cost of Goods Sold", "cost-of-goods-sold"],
    ["6000", "Operating Expenses", "expense"],
  ] as const

  for (const [index, [accountNumber, name, type]] of seedAccounts.entries()) {
    await db
      .insert(accounts)
      .values({
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        companyId: "00000000-0000-4000-8000-000000000001",
        accountNumber,
        name,
        type,
        currency: "USD",
      })
      .onConflictDoUpdate({
        target: [accounts.companyId, accounts.accountNumber],
        set: { name, type, currency: "USD", active: true },
      })
  }

  await db
    .insert(fiscalPeriods)
    .values({
      id: "20000000-0000-4000-8000-000000000001",
      companyId: "00000000-0000-4000-8000-000000000001",
      name: "FY 2026",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T23:59:59.999Z"),
      status: "open",
    })
    .onConflictDoUpdate({
      target: [fiscalPeriods.companyId, fiscalPeriods.name],
      set: { status: "open" },
    })

  await close()
  console.log("BLUE PLASTIC CENTER database seed completed")
}

void seed()
