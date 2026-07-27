import type { FastifyInstance } from "fastify";
import { authorize } from "../../platform/auth.js";
import type { ResourceService } from "../../services/resource-service.js";
import { listQuerySchema, type ResourceParams, writeSchema } from "./resource.schemas.js";

export async function resourceRoutes(app: FastifyInstance, service: ResourceService) {
  app.post<{ Params: Pick<ResourceParams, "id"> }>("/accounting/journal-entries/:id/post", async (request) => {
    authorize(request.requestContext.principal, "post");
    return { data: await service.postJournal(request.requestContext, request.params.id) };
  });

  app.get<{ Params: Omit<ResourceParams, "id"> }>("/:module/:resource", async (request) => {
    authorize(request.requestContext.principal, "read");
    const query = listQuerySchema.parse(request.query);
    const { module, resource } = request.params;
    const result = await service.list(request.requestContext, module, resource, query);
    return {
      data: result.data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    };
  });

  app.get<{ Params: ResourceParams }>("/:module/:resource/:id", async (request) => {
    authorize(request.requestContext.principal, "read");
    const { module, resource, id } = request.params;
    return { data: await service.get(request.requestContext, module, resource, id) };
  });

  app.post<{ Params: Omit<ResourceParams, "id"> }>("/:module/:resource", async (request, reply) => {
    authorize(request.requestContext.principal, "create");
    const { module, resource } = request.params;
    const record = await service.create(request.requestContext, module, resource, writeSchema.parse(request.body));
    return reply.header("Location", `/v1/${module}/${resource}/${record.id}`).code(201).send({ data: record });
  });

  app.patch<{ Params: ResourceParams }>("/:module/:resource/:id", async (request) => {
    authorize(request.requestContext.principal, "update");
    const { module, resource, id } = request.params;
    return { data: await service.update(request.requestContext, module, resource, id, writeSchema.parse(request.body)) };
  });

  app.delete<{ Params: ResourceParams }>("/:module/:resource/:id", async (request, reply) => {
    authorize(request.requestContext.principal, "delete");
    const { module, resource, id } = request.params;
    await service.remove(request.requestContext, module, resource, id);
    return reply.code(204).send();
  });
}
