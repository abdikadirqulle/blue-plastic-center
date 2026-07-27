import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authorize } from "../../platform/auth.js";

const reportSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  basis: z.enum(["cash", "accrual"]).default("accrual"),
  currency: z.string().length(3).default("USD"),
});

export async function reportRoutes(app: FastifyInstance) {
  app.post<{ Params: { kind: string } }>("/reports/:kind/run", async (request, reply) => {
    authorize(request.requestContext.principal, "read");
    const parameters = reportSchema.parse(request.body);
    return reply.code(201).send({
      data: {
        reportId: randomUUID(),
        kind: request.params.kind,
        status: "generated",
        parameters,
        generatedAt: new Date().toISOString(),
        rows: [],
      },
    });
  });
}
