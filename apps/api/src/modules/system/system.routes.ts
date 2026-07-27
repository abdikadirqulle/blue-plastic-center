import type { FastifyInstance } from "fastify";
import { modules } from "../../domain/modules.js";
import { authorize } from "../../platform/auth.js";
import type { ResourceRepository } from "../../repositories/resource-repository.js";

export async function systemRoutes(app: FastifyInstance, repository: ResourceRepository) {
  app.get("/meta/modules", async (request) => {
    authorize(request.requestContext.principal, "read");
    return { data: modules };
  });

  app.get("/audit-events", async (request) => {
    authorize(request.requestContext.principal, "read");
    const query = request.query as { limit?: string };
    const limit = Math.min(Number(query.limit ?? 100), 500);
    return { data: await repository.listAudit(request.requestContext.companyId, limit) };
  });
}
