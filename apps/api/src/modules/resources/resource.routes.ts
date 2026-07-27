import type { FastifyInstance } from "fastify"
import { createHash } from "node:crypto"
import { authorizeResource } from "../../platform/auth.js"
import type { ResourceService } from "../../services/resource-service.js"
import {
  listQuerySchema,
  type ResourceParams,
  writeSchema,
} from "./resource.schemas.js"

export async function resourceRoutes(
  app: FastifyInstance,
  service: ResourceService,
) {
  app.get<{ Params: Omit<ResourceParams, "id"> }>(
    "/:module/:resource",
    async (request) => {
      authorizeResource(
        request.requestContext.principal,
        "read",
        request.params.module,
      )
      const query = listQuerySchema.parse(request.query)
      const { module, resource } = request.params
      const result = await service.list(
        request.requestContext,
        module,
        resource,
        query,
      )
      return {
        data: result.data,
        meta: {
          page: query.page,
          pageSize: query.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / query.pageSize),
        },
      }
    },
  )

  app.get<{ Params: ResourceParams }>(
    "/:module/:resource/:id",
    async (request) => {
      authorizeResource(
        request.requestContext.principal,
        "read",
        request.params.module,
      )
      const { module, resource, id } = request.params
      return {
        data: await service.get(request.requestContext, module, resource, id),
      }
    },
  )

  app.post<{ Params: Omit<ResourceParams, "id"> }>(
    "/:module/:resource",
    async (request, reply) => {
      authorizeResource(
        request.requestContext.principal,
        "create",
        request.params.module,
      )
      const { module, resource } = request.params
      const input = writeSchema.parse(request.body)
      const idempotencyKey = request.headers["idempotency-key"]
      const idempotency =
        typeof idempotencyKey === "string"
          ? {
              key: idempotencyKey,
              requestHash: createHash("sha256")
                .update(JSON.stringify(input))
                .digest("hex"),
            }
          : undefined
      const record = await service.create(
        request.requestContext,
        module,
        resource,
        input,
        idempotency,
      )
      return reply
        .header("Location", `/v1/${module}/${resource}/${record.id}`)
        .code(201)
        .send({ data: record })
    },
  )

  app.patch<{ Params: ResourceParams }>(
    "/:module/:resource/:id",
    async (request) => {
      authorizeResource(
        request.requestContext.principal,
        "update",
        request.params.module,
      )
      const { module, resource, id } = request.params
      return {
        data: await service.update(
          request.requestContext,
          module,
          resource,
          id,
          writeSchema.parse(request.body),
        ),
      }
    },
  )

  app.delete<{ Params: ResourceParams }>(
    "/:module/:resource/:id",
    async (request, reply) => {
      authorizeResource(
        request.requestContext.principal,
        "delete",
        request.params.module,
      )
      const { module, resource, id } = request.params
      await service.remove(request.requestContext, module, resource, id)
      return reply.code(204).send()
    },
  )
}
