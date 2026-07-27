import "dotenv/config"
import { createDatabase } from "./client.js"
import { branches, companies, users } from "./schema.js"
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

  await close()
  console.log("BLUE PLASTIC CENTER database seed completed")
}

void seed()
