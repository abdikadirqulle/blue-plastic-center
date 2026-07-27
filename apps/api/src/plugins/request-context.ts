import { randomUUID } from "node:crypto";
import fp from "fastify-plugin";
import { authenticate } from "../platform/auth.js";

const defaultCompanyId = "00000000-0000-4000-8000-000000000001";
const defaultBranchId = "00000000-0000-4000-8000-000000000011";

export const requestContextPlugin = fp(async (app) => {
  app.decorateRequest("requestContext");
  app.addHook("onRequest", async (request, reply) => {
    if (!request.url.startsWith("/v1/")) return;

    request.requestContext = {
      requestId: String(request.headers["x-request-id"] ?? randomUUID()),
      companyId: String(request.headers["x-company-id"] ?? defaultCompanyId),
      branchId: String(request.headers["x-branch-id"] ?? defaultBranchId),
      principal: authenticate(request.headers.authorization),
    };
    reply.header("X-Request-Id", request.requestContext.requestId);
  });
});
