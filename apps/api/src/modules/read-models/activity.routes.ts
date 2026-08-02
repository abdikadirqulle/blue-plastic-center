import type { FastifyInstance } from "fastify"
import { authorizeResource } from "../../platform/auth.js"
import type { ResourceService } from "../../services/resource-service.js"
import type { RecordReadModel } from "./record-read-model.js"

interface ActivityParams {
  module: string
  resource: string
  id: string
}

/**
 * The register behind a record: what it owes or holds, the documents that moved
 * it, and who changed it. Reads only, and scoped by the same permission as the
 * record itself.
 */
export async function activityRoutes(
  app: FastifyInstance,
  service: ResourceService,
  readModel: RecordReadModel,
) {
  app.get<{ Params: ActivityParams }>(
    "/:module/:resource/:id/activity",
    async (request) => {
      const { module, resource, id } = request.params
      authorizeResource(request.requestContext.principal, "read", module)
      const record = await service.get(
        request.requestContext,
        module,
        resource,
        id,
      )
      return {
        data: await readModel.activity(
          request.requestContext,
          module,
          resource,
          record,
        ),
      }
    },
  )
}
