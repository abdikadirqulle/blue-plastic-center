import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authorize } from "../../platform/auth.js";
import type { ResourceService } from "../../services/resource-service.js";

const importSchema = z.object({
  module: z.string().min(1),
  resource: z.string().min(1),
  rows: z.array(z.record(z.unknown())).min(1).max(5000),
  dryRun: z.boolean().default(true),
});

export async function importRoutes(app: FastifyInstance, resources: ResourceService) {
  app.post("/imports", async (request, reply) => {
    authorize(request.requestContext.principal, "create");
    const input = importSchema.parse(request.body);
    const errors: Array<{ row: number; message: string }> = []
    let importedRows = 0

    for (const [index, source] of input.rows.entries()) {
      try {
        const { status, ...row } = source
        const data = resources.validateData(input.module, input.resource, row)
        if (!input.dryRun) {
          await resources.create(request.requestContext, input.module, input.resource, {
            data,
            status: typeof status === "string" ? status : "draft",
          })
          importedRows += 1
        }
      } catch (error) {
        errors.push({
          row: index + 2,
          message: error instanceof Error ? error.message : "Invalid row",
        })
      }
    }

    return reply.code(input.dryRun ? 202 : 201).send({
      data: {
        importId: randomUUID(),
        status: errors.length ? "completed-with-errors" : input.dryRun ? "validated" : "completed",
        totalRows: input.rows.length,
        validRows: input.rows.length - errors.length,
        invalidRows: errors.length,
        importedRows,
        errors,
      },
    });
  });
}
