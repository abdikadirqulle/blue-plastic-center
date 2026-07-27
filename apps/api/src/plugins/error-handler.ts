import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ApiError } from "../platform/errors.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: { code: "NOT_FOUND", message: "API route not found" } }),
  );

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.code(error.status).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
    }
    if (error instanceof z.ZodError) {
      return reply.code(422).send({
        error: {
          code: "VALIDATION_ERROR",
          message: "Request validation failed",
          details: error.flatten(),
        },
      });
    }
    app.log.error(error);
    return reply.code(500).send({
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" },
    });
  });
}
