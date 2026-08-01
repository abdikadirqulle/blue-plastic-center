import "dotenv/config";
import { createApp } from "./app.js";
import { loadEnv } from "./config/env.js";
import { createDatabase } from "./db/client.js";
import { MemoryIdentityRepository } from "./modules/auth/memory-identity-repository.js";
import { PostgresIdentityRepository } from "./modules/auth/postgres-identity-repository.js";
import { MemoryLedgerRepository } from "./modules/accounting/memory-ledger-repository.js";
import { PostgresLedgerRepository } from "./modules/accounting/postgres-ledger-repository.js";
import { PostgresInvoiceRepository } from "./modules/sales/postgres-invoice-repository.js";
import { PostgresInventoryMovements } from "./modules/inventory/postgres-inventory-movements.js";
import { MemoryResourceRepository } from "./repositories/memory-resource-repository.js";
import { PostgresResourceRepository } from "./repositories/postgres-resource-repository.js";
import { allowedWebOrigins } from "./config/env.js";
import { terminal } from "./platform/terminal.js";

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
const invoiceRepository = database && ledgerRepository instanceof PostgresLedgerRepository
  ? new PostgresInvoiceRepository(
      database.db,
      ledgerRepository,
      new PostgresInventoryMovements(database.db),
    )
  : undefined;
const app = createApp(repository, env, identityRepository, ledgerRepository, invoiceRepository);

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  terminal.banner({
    host: env.HOST === "0.0.0.0" ? "localhost" : env.HOST,
    port: env.PORT,
    environment: env.NODE_ENV,
    persistence: database ? "PostgreSQL / Drizzle" : "In-memory",
    origins: allowedWebOrigins(env),
  });
  terminal.success("Database and API routes are ready");
} catch (error) {
  terminal.error(error instanceof Error ? error.message : "API failed to start");
  await database?.close();
  throw error;
}

const shutdown = async () => {
  terminal.warning("Shutting down API gracefully…");
  await app.close();
  await database?.close();
  terminal.success("API stopped");
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
