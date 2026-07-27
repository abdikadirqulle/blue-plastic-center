import { randomUUID } from "node:crypto"
import type { FastifyInstance } from "fastify"
import { authorizeResource } from "../../platform/auth.js"
import type { ResourceService } from "../../services/resource-service.js"
import { attachmentSchema, pdfJobSchema } from "./document.schemas.js"

interface EntityParams {
  module: string
  resource: string
  id: string
}

export async function documentRoutes(
  app: FastifyInstance,
  resources: ResourceService,
) {
  app.post<{ Params: EntityParams }>(
    "/:module/:resource/:id/attachments",
    async (request, reply) => {
      authorizeResource(
        request.requestContext.principal,
        "update",
        request.params.module,
      )
      await resources.get(
        request.requestContext,
        request.params.module,
        request.params.resource,
        request.params.id,
      )
      const input = attachmentSchema.parse(request.body)
      const record = await resources.create(
        request.requestContext,
        "documents",
        "attachments",
        {
          status: "pending-upload",
          data: {
            ...input,
            entityModule: request.params.module,
            entityResource: request.params.resource,
            entityId: request.params.id,
            storageKey: `${request.requestContext.companyId}/${request.params.module}/${request.params.id}/${randomUUID()}-${input.fileName}`,
          },
        },
      )
      return reply.code(201).send({ data: record })
    },
  )

  app.post<{ Params: EntityParams }>(
    "/:module/:resource/:id/pdf",
    async (request, reply) => {
      authorizeResource(
        request.requestContext.principal,
        "read",
        request.params.module,
      )
      await resources.get(
        request.requestContext,
        request.params.module,
        request.params.resource,
        request.params.id,
      )
      const input = pdfJobSchema.parse(request.body)
      const record = await resources.create(
        request.requestContext,
        "documents",
        "pdf-jobs",
        {
          status: "queued",
          data: {
            ...input,
            entityModule: request.params.module,
            entityResource: request.params.resource,
            entityId: request.params.id,
          },
        },
      )
      return reply.code(202).send({ data: record })
    },
  )
}
