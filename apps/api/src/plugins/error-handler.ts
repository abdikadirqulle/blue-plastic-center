import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "../platform/errors.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "API route not found" } }),
  );

  app.setErrorHandler((error, request, reply) => {
    const requestId = request.requestContext?.requestId ?? request.id;
    if (error instanceof ApiError) {
      request.log.warn({ requestId, code: error.code, details: error.details }, error.message);
      return reply.code(error.status).send({
        error: { code: error.code, message: error.message, details: error.details, requestId },
      });
    }
    if (error instanceof z.ZodError) {
      request.log.warn({ requestId, issues: error.issues }, "Request validation failed");
      return reply.code(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.flatten(),
          requestId,
        },
      });
    }
    request.log.error({ requestId, error }, "Unhandled API error");
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred", requestId },
    });
  });
}
