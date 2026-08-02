import cors from "@fastify/cors"
import cookie from "@fastify/cookie"
import helmet from "@fastify/helmet"
import rateLimit from "@fastify/rate-limit"
import Fastify from "fastify"
import { allowedWebOrigins, type AppEnv } from "./config/env.js"
import { authRoutes } from "./modules/auth/auth.routes.js"
import { AuthService } from "./modules/auth/auth-service.js"
import type { IdentityRepository } from "./modules/auth/identity-repository.js"
import { MemoryIdentityRepository } from "./modules/auth/memory-identity-repository.js"
import { bankingRoutes } from "./modules/banking/banking.routes.js"
import { accountingRoutes } from "./modules/accounting/accounting.routes.js"
import type { LedgerRepository } from "./modules/accounting/ledger-repository.js"
import { MemoryLedgerRepository } from "./modules/accounting/memory-ledger-repository.js"
import { documentRoutes } from "./modules/documents/document.routes.js"
import { inventoryRoutes } from "./modules/inventory/inventory.routes.js"
import { OperationalWorkflowService } from "./modules/operations/operational-workflow.service.js"
import { purchasingRoutes } from "./modules/purchasing/purchasing.routes.js"
import { salesRoutes } from "./modules/sales/sales.routes.js"
import { InvoiceService } from "./modules/sales/invoice-service.js"
import type { InvoiceRepository } from "./modules/sales/invoice-repository.js"
import { MemoryInvoiceRepository } from "./modules/sales/memory-invoice-repository.js"
import { MemoryInventoryMovements } from "./modules/inventory/memory-inventory-movements.js"
import type { InventoryReadPort } from "./modules/inventory/inventory-movement-port.js"
import { activityRoutes } from "./modules/read-models/activity.routes.js"
import { RecordReadModel } from "./modules/read-models/record-read-model.js"
import { projectRoutes } from "./modules/projects/project.routes.js"
import { payrollRoutes } from "./modules/payroll/payroll.routes.js"
import { importRoutes } from "./modules/imports/import.routes.js"
import { reportRoutes } from "./modules/reports/report.routes.js"
import { resourceRoutes } from "./modules/resources/resource.routes.js"
import { systemRoutes } from "./modules/system/system.routes.js"
import { trashRoutes } from "./modules/trash/trash.routes.js"
import { registerErrorHandler } from "./plugins/error-handler.js"
import { createRequestContextPlugin } from "./plugins/request-context.js"
import { MemoryResourceRepository } from "./repositories/memory-resource-repository.js"
import type { ResourceRepository } from "./repositories/resource-repository.js"
import { ResourceService } from "./services/resource-service.js"

const defaultEnv: AppEnv = {
  NODE_ENV: "test",
  HOST: "0.0.0.0",
  PORT: 4000,
  WEB_ORIGIN: "http://localhost:5173",
  WEB_ORIGINS: "",
  LOG_LEVEL: "silent",
  SESSION_TTL_HOURS: 12,
  COOKIE_SECURE: false,
}

export function createApp(
  repository: ResourceRepository = new MemoryResourceRepository(),
  env: AppEnv = defaultEnv,
  identityRepository: IdentityRepository = new MemoryIdentityRepository(),
  ledgerRepository?: LedgerRepository,
  invoiceRepository?: InvoiceRepository,
  inventoryReadPort?: InventoryReadPort,
) {
  const app = Fastify({
    logger: env.LOG_LEVEL === "silent" ? false : { level: env.LOG_LEVEL },
    requestIdHeader: "x-request-id",
  })
  const ledger = ledgerRepository ?? new MemoryLedgerRepository(repository)
  // Invoices are always served by a normalized repository. Without a database
  // the in-memory implementation keeps the same tables, posting order and
  // constraints, so the JSONB resource store never holds invoice data.
  const stock = new MemoryInventoryMovements()
  const invoiceStore =
    invoiceRepository ??
    new MemoryInvoiceRepository(
      repository,
      ledger instanceof MemoryLedgerRepository
        ? ledger
        : new MemoryLedgerRepository(repository),
      stock,
    )
  // Balances are read from the ledger, the invoice tables and the stock ledger
  // on every request, so no screen can show a figure the books disagree with.
  const readModel = new RecordReadModel(
    repository,
    ledger,
    invoiceStore,
    inventoryReadPort ?? stock,
  )
  const service = new ResourceService(repository, invoiceStore, readModel)
  const invoices = new InvoiceService(invoiceStore)
  const authService = new AuthService(identityRepository, env.SESSION_TTL_HOURS)
  const workflows = new OperationalWorkflowService(service)

  registerErrorHandler(app)
  app.register(helmet)
  app.register(cookie)
  app.register(rateLimit)
  app.register(cors, {
    origin: allowedWebOrigins(env),
    credentials: true,
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Company-Id",
      "X-Branch-Id",
      "X-Request-Id",
      "X-CSRF-Token",
      "Idempotency-Key",
    ],
    exposedHeaders: ["X-Request-Id"],
  })
  app.register(createRequestContextPlugin(authService))

  app.get("/health", async () => ({
    data: {
      service: "blue-plastic-api",
      status: "healthy",
      version: "0.2.0",
      time: new Date().toISOString(),
    },
  }))

  app.register(
    async (v1) => {
      await v1.register(async (auth) => authRoutes(auth, authService, env), {
        prefix: "/auth",
      })
      await v1.register(
        async (sales) => salesRoutes(sales, workflows, service, invoices),
        { prefix: "/sales" },
      )
      await v1.register(
        async (accounting) => accountingRoutes(accounting, service, ledger),
        { prefix: "/accounting" },
      )
      await v1.register(
        async (projects) => projectRoutes(projects, service),
        { prefix: "/projects" },
      )
      await v1.register(
        async (payroll) => payrollRoutes(payroll, service),
        { prefix: "/payroll" },
      )
      await v1.register(
        async (purchasing) => purchasingRoutes(purchasing, workflows, service),
        { prefix: "/purchasing" },
      )
      await v1.register(
        async (inventory) => inventoryRoutes(inventory, workflows),
        { prefix: "/inventory" },
      )
      await v1.register(
        async (banking) => bankingRoutes(banking, workflows, service),
        { prefix: "/banking" },
      )
      await v1.register(
        async (documents) => documentRoutes(documents, service),
        { prefix: "/documents" },
      )
      await v1.register(async (trash) => trashRoutes(trash, service), {
        prefix: "/trash",
      })
      await systemRoutes(v1, repository)
      await reportRoutes(v1, ledger, service, repository)
      await importRoutes(v1, service)
      await activityRoutes(v1, service, readModel)
      await resourceRoutes(v1, service)
    },
    { prefix: "/v1" },
  )

  return app
}
