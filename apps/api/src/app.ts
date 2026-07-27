import cors from "@fastify/cors"
import helmet from "@fastify/helmet"
import Fastify from "fastify"
import type { AppEnv } from "./config/env.js"
import { importRoutes } from "./modules/imports/import.routes.js"
import { reportRoutes } from "./modules/reports/report.routes.js"
import { resourceRoutes } from "./modules/resources/resource.routes.js"
import { systemRoutes } from "./modules/system/system.routes.js"
import { registerErrorHandler } from "./plugins/error-handler.js"
import { requestContextPlugin } from "./plugins/request-context.js"
import { MemoryResourceRepository } from "./repositories/memory-resource-repository.js"
import type { ResourceRepository } from "./repositories/resource-repository.js"
import { ResourceService } from "./services/resource-service.js"

const defaultEnv: AppEnv = {
  NODE_ENV: "test",
  HOST: "0.0.0.0",
  PORT: 4000,
  WEB_ORIGIN: "http://localhost:5173",
  LOG_LEVEL: "silent",
}

export function createApp(
  repository: ResourceRepository = new MemoryResourceRepository(),
  env: AppEnv = defaultEnv,
) {
  const app = Fastify({
    logger: env.LOG_LEVEL === "silent" ? false : { level: env.LOG_LEVEL },
    requestIdHeader: "x-request-id",
  })
  const service = new ResourceService(repository)

  registerErrorHandler(app)
  app.register(helmet)
  app.register(cors, {
    origin: env.WEB_ORIGIN,
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "X-Company-Id",
      "X-Branch-Id",
      "X-Request-Id",
    ],
    exposedHeaders: ["X-Request-Id"],
  })
  app.register(requestContextPlugin)

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
      await systemRoutes(v1, repository)
      await reportRoutes(v1)
      await importRoutes(v1)
      await resourceRoutes(v1, service)
    },
    { prefix: "/v1" },
  )

  return app
}
