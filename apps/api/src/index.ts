import "dotenv/config";
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDatabase } from "./db/client.js";
import { MemoryResourceRepository } from "./repositories/memory-resource-repository.js";
import { PostgresResourceRepository } from "./repositories/postgres-resource-repository.js";

const port = Number(process.env.PORT ?? 4000);
const databaseUrl = process.env.DATABASE_URL;
const database = databaseUrl ? createDatabase(databaseUrl) : undefined;
const repository = database ? new PostgresResourceRepository(database.db) : new MemoryResourceRepository();
const app = createApp(repository);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Al-Furat API listening on http://localhost:${info.port}`);
  console.log(database ? "Persistence: PostgreSQL" : "Persistence: in-memory development repository");
});
