import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { MemoryIdentityRepository } from "./modules/auth/memory-identity-repository.js";
import { PostgresIdentityRepository } from "./modules/auth/postgres-identity-repository.js";
import { MemoryLedgerRepository } from "./modules/accounting/memory-ledger-repository.js";
import { PostgresLedgerRepository } from "./modules/accounting/postgres-ledger-repository.js";
import { MemoryResourceRepository } from "./repositories/memory-resource-repository.js";
import { PostgresResourceRepository } from "./repositories/postgres-resource-repository.js";

const env = loadEnv();
const databaseUrl = env.DATABASE_URL;
const database = databaseUrl ? createDatabase(databaseUrl) : undefined;
const repository = database ? new PostgresResourceRepository(database.db) : new MemoryResourceRepository();
const identityRepository = database
  ? new PostgresIdentityRepository(database.db)
  : new MemoryIdentityRepository();
const ledgerRepository = database
  ? new PostgresLedgerRepository(database.db)
  : new MemoryLedgerRepository(repository);
const app = createApp(repository, env, identityRepository, ledgerRepository);

await app.listen({ host: env.HOST, port: env.PORT });
app.log.info({ persistence: database ? "postgresql" : "memory" }, "BLUE PLASTIC CENTER API started");

const shutdown = async () => {
  await app.close();
  await database?.close();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
