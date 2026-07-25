import "dotenv/config";
import { createDatabase } from "./client.js";
import { branches, companies, users } from "./schema.js";

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required to seed the database");
  const { db, close } = createDatabase(databaseUrl);

  await db.insert(companies).values({
    id: "00000000-0000-4000-8000-000000000001",
    legalName: "Al-Furat Group",
    functionalCurrency: "USD",
  }).onConflictDoNothing();

  await db.insert(branches).values({
    id: "00000000-0000-4000-8000-000000000011",
    companyId: "00000000-0000-4000-8000-000000000001",
    name: "Main company",
    code: "MAIN",
  }).onConflictDoNothing();

  await db.insert(users).values([
    { id: "00000000-0000-4000-8000-000000000001", email: "abdikadir@alfurat.example", displayName: "Abdikadir Qulle", role: "administrator" },
    { id: "00000000-0000-4000-8000-000000000002", email: "amina@alfurat.example", displayName: "Amina Yusuf", role: "accountant" },
    { id: "00000000-0000-4000-8000-000000000003", email: "viewer@alfurat.example", displayName: "Read Only User", role: "viewer" },
  ]).onConflictDoNothing();

  await close();
  console.log("Al-Furat database seed completed");
}

void seed();
