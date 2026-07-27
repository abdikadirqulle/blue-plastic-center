import { randomUUID } from "node:crypto"
import fp from "fastify-plugin"
import type { AuthService } from "../modules/auth/auth-service.js"

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"])

export function createRequestContextPlugin(authService: AuthService) {
  return fp(async (app) => {
    app.decorateRequest("requestContext")
    app.addHook("onRequest", async (request, reply) => {
      if (!request.url.startsWith("/v1/") || request.url.startsWith("/v1/auth/login")) return
      const sessionToken = request.cookies.blue_session
      const identity = await authService.authenticate(sessionToken)
      if (!safeMethods.has(request.method)) {
        await authService.verifyCsrf(sessionToken, request.headers["x-csrf-token"] as string | undefined)
      }
      request.requestContext = {
        requestId: String(request.headers["x-request-id"] ?? randomUUID()),
        companyId: identity.companyId,
        branchId: identity.branchId,
        principal: identity.principal,
      }
      reply.header("X-Request-Id", request.requestContext.requestId)
    })
  })
}
