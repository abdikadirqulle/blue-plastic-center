import "dotenv/config";
import { createDatabase } from "./client.js";
import { branches, companies, users } from "./schema.js";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to seed the database");
  const { db, close } = createDatabase(databaseUrl);

  await db.insert(companies).values({
    id: "00000000-0000-4000-8000-000000000001",
    legalName: "BLUE PLASTIC CENTER",
    functionalCurrency: "USD",
  }).onConflictDoUpdate({
    target: companies.id,
    set: { legalName: "BLUE PLASTIC CENTER" },
  });

  await db.insert(branches).values({
    id: "00000000-0000-4000-8000-000000000011",
    companyId: "00000000-0000-4000-8000-000000000001",
    name: "Main company",
    code: "MAIN",
  }).onConflictDoNothing();

  const seedUsers = [
    { id: "00000000-0000-4000-8000-000000000001", email: "abdikadir@blueplastic.example", displayName: "Abdikadir Qulle", role: "administrator" },
    { id: "00000000-0000-4000-8000-000000000002", email: "amina@blueplastic.example", displayName: "Amina Yusuf", role: "accountant" },
    { id: "00000000-0000-4000-8000-000000000003", email: "viewer@blueplastic.example", displayName: "Read Only User", role: "viewer" },
  ] as const;

  for (const user of seedUsers) {
    await db.insert(users).values(user).onConflictDoUpdate({
      target: users.id,
      set: { email: user.email, displayName: user.displayName, role: user.role },
    });
  }

  await close();
  console.log("BLUE PLASTIC CENTER database seed completed");
}

void seed();
