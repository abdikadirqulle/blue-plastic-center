import type { RequestContext } from "../platform/types.js";

declare module "fastify" {
  interface FastifyRequest {
    requestContext: RequestContext;
  }
}
