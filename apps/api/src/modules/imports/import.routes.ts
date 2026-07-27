import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authorize } from "../../platform/auth.js";

const importSchema = z.object({
  module: z.string().min(1),
  resource: z.string().min(1),
  rows: z.array(z.record(z.unknown())).min(1).max(5000),
  dryRun: z.boolean().default(true),
});

export async function importRoutes(app: FastifyInstance) {
  app.post("/imports", async (request, reply) => {
    authorize(request.requestContext.principal, "create");
    const input = importSchema.parse(request.body);
    return reply.code(202).send({
      data: {
        importId: randomUUID(),
        status: input.dryRun ? "validated" : "queued",
        totalRows: input.rows.length,
        validRows: input.rows.length,
        invalidRows: 0,
        errors: [],
      },
    });
  });
}
