import type { FastifyInstance } from "fastify"
import { z } from "zod"
import type { AppEnv } from "../../config/env.js"
import type { AuthService } from "./auth-service.js"
import { ApiError } from "../../platform/errors.js"

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
})

const roleSchema = z.enum(["administrator", "accountant", "viewer"])
const createUserSchema = z.object({
  email: z.string().email(),
  displayName: z.string().trim().min(2).max(100),
  role: roleSchema,
  password: z.string().min(10).max(128),
})
const resetPasswordSchema = z.object({ password: z.string().min(10).max(128) })

function requireAdministrator(role: string) {
  if (role !== "administrator") throw new ApiError(403, "FORBIDDEN", "Administrator access is required")
}

export async function authRoutes(app: FastifyInstance, authService: AuthService, env: AppEnv) {
  app.post("/login", {
    config: { rateLimit: { max: 5, timeWindow: "15 minutes" } },
  }, async (request, reply) => {
    const input = loginSchema.parse(request.body)
    const result = await authService.login(input.email, input.password, {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
    })
    reply.setCookie("blue_session", result.token, {
      path: "/",
      httpOnly: true,
      sameSite: "strict",
      secure: env.COOKIE_SECURE ?? env.NODE_ENV === "production",
      maxAge: env.SESSION_TTL_HOURS * 60 * 60,
    })
    return { data: { user: result.user, csrfToken: result.csrfToken } }
  })

  app.get("/me", async (request) => ({ data: { user: request.requestContext.principal } }))

  app.get("/users", async (request) => {
    requireAdministrator(request.requestContext.principal.role)
    return { data: await authService.listUsers(request.requestContext.companyId) }
  })

  app.post("/users", async (request, reply) => {
    requireAdministrator(request.requestContext.principal.role)
    const input = createUserSchema.parse(request.body)
    const user = await authService.createUser({
      ...input,
      companyId: request.requestContext.companyId,
      branchId: request.requestContext.branchId,
    })
    return reply.code(201).send({ data: user })
  })

  app.post<{ Params: { id: string } }>("/users/:id/reset-password", async (request, reply) => {
    requireAdministrator(request.requestContext.principal.role)
    const input = resetPasswordSchema.parse(request.body)
    await authService.resetPassword(request.params.id, input.password)
    return reply.code(204).send()
  })

  app.post("/logout", async (request, reply) => {
    await authService.logout(request.cookies.blue_session)
    reply.clearCookie("blue_session", { path: "/" })
    return reply.code(204).send()
  })
}
