import type { FastifyInstance } from "fastify"
import { authorize } from "../../platform/auth.js"
import type { ResourceService } from "../../services/resource-service.js"
import { trashParamsSchema, trashQuerySchema } from "./trash.schemas.js"

export async function trashRoutes(
  app: FastifyInstance,
  resources: ResourceService,
) {
  app.get("/", async (request) => {
    authorize(request.requestContext.principal, "delete")
    const query = trashQuerySchema.parse(request.query)
    const result = await resources.listTrash(request.requestContext, query)
    return {
      data: result.data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    }
  })

  app.post<{ Params: { id: string } }>("/:id/restore", async (request) => {
    authorize(request.requestContext.principal, "delete")
    const { id } = trashParamsSchema.parse(request.params)
    return { data: await resources.restore(request.requestContext, id) }
  })
}
