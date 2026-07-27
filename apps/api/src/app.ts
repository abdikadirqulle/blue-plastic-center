import { randomUUID } from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { z } from "zod";
import { modules } from "./domain/modules.js";
import { authenticate, authorize } from "./platform/auth.js";
import { ApiError } from "./platform/errors.js";
import type { RequestContext } from "./platform/types.js";
import { MemoryResourceRepository } from "./repositories/memory-resource-repository.js";
import type { ResourceRepository } from "./repositories/resource-repository.js";
import { ResourceService } from "./services/resource-service.js";

type Variables = { requestContext: RequestContext };

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  sort: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const writeSchema = z.object({
  status: z.string().trim().min(1).optional(),
  version: z.number().int().positive().optional(),
  data: z.record(z.unknown()),
});

const companyId = "00000000-0000-4000-8000-000000000001";
const branchId = "00000000-0000-4000-8000-000000000011";

async function jsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
  }
}

export function createApp(repository: ResourceRepository = new MemoryResourceRepository()) {
  const app = new Hono<{ Variables: Variables }>();
  const service = new ResourceService(repository);

  app.use("*", secureHeaders());
  app.use("*", cors({
    origin: (origin) => origin || "http://localhost:3000",
    allowHeaders: ["Authorization", "Content-Type", "X-Company-Id", "X-Branch-Id", "X-Request-Id"],
    exposeHeaders: ["X-Request-Id"],
  }));

  app.use("/v1/*", async (context, next) => {
    const principal = authenticate(context.req.header("Authorization"));
    const requestContext: RequestContext = {
      requestId: context.req.header("X-Request-Id") ?? randomUUID(),
      companyId: context.req.header("X-Company-Id") ?? companyId,
      branchId: context.req.header("X-Branch-Id") ?? branchId,
      principal,
    };
    context.set("requestContext", requestContext);
    context.header("X-Request-Id", requestContext.requestId);
    await next();
  });

  app.get("/health", (context) => context.json({
    data: {
      service: "blue-plastic-api",
      status: "healthy",
      version: "0.2.0",
      time: new Date().toISOString(),
    },
  }));

  app.get("/v1/meta/modules", (context) => {
    authorize(context.get("requestContext").principal, "read");
    return context.json({ data: modules });
  });

  app.get("/v1/audit-events", async (context) => {
    const requestContext = context.get("requestContext");
    authorize(requestContext.principal, "read");
    const limit = Math.min(Number(context.req.query("limit") ?? 100), 500);
    return context.json({ data: await repository.listAudit(requestContext.companyId, limit) });
  });

  app.post("/v1/accounting/journal-entries/:id/post", async (context) => {
    const requestContext = context.get("requestContext");
    authorize(requestContext.principal, "post");
    return context.json({ data: await service.postJournal(requestContext, context.req.param("id")) });
  });

  app.post("/v1/reports/:kind/run", async (context) => {
    const requestContext = context.get("requestContext");
    authorize(requestContext.principal, "read");
    const input = z.object({
      from: z.string().date(),
      to: z.string().date(),
      basis: z.enum(["cash", "accrual"]).default("accrual"),
      currency: z.string().length(3).default("USD"),
    }).parse(await jsonBody(context.req.raw));
    return context.json({
      data: {
        reportId: randomUUID(),
        kind: context.req.param("kind"),
        status: "generated",
        parameters: input,
        generatedAt: new Date().toISOString(),
        rows: [],
      },
    }, 201);
  });

  app.post("/v1/imports", async (context) => {
    const requestContext = context.get("requestContext");
    authorize(requestContext.principal, "create");
    const input = z.object({
      module: z.string(),
      resource: z.string(),
      rows: z.array(z.record(z.unknown())).min(1).max(5000),
      dryRun: z.boolean().default(true),
    }).parse(await jsonBody(context.req.raw));
    return context.json({
      data: {
        importId: randomUUID(),
        status: input.dryRun ? "validated" : "queued",
        totalRows: input.rows.length,
        validRows: input.rows.length,
        invalidRows: 0,
        errors: [],
      },
    }, 202);
  });

  app.get("/v1/:module/:resource", async (context) => {
    const requestContext = context.get("requestContext");
    authorize(requestContext.principal, "read");
    const query = listQuerySchema.parse(context.req.query());
    const result = await service.list(requestContext, context.req.param("module"), context.req.param("resource"), query);
    return context.json({
      data: result.data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    });
  });

  app.get("/v1/:module/:resource/:id", async (context) => {
    const requestContext = context.get("requestContext");
    authorize(requestContext.principal, "read");
    return context.json({ data: await service.get(requestContext, context.req.param("module"), context.req.param("resource"), context.req.param("id")) });
  });

  app.post("/v1/:module/:resource", async (context) => {
    const requestContext = context.get("requestContext");
    authorize(requestContext.principal, "create");
    const input = writeSchema.parse(await jsonBody(context.req.raw));
    const record = await service.create(requestContext, context.req.param("module"), context.req.param("resource"), input);
    context.header("Location", `/v1/${record.module}/${record.resource}/${record.id}`);
    return context.json({ data: record }, 201);
  });

  app.patch("/v1/:module/:resource/:id", async (context) => {
    const requestContext = context.get("requestContext");
    authorize(requestContext.principal, "update");
    const input = writeSchema.parse(await jsonBody(context.req.raw));
    return context.json({ data: await service.update(requestContext, context.req.param("module"), context.req.param("resource"), context.req.param("id"), input) });
  });

  app.delete("/v1/:module/:resource/:id", async (context) => {
    const requestContext = context.get("requestContext");
    authorize(requestContext.principal, "delete");
    await service.remove(requestContext, context.req.param("module"), context.req.param("resource"), context.req.param("id"));
    return context.body(null, 204);
  });

  app.notFound((context) => context.json({ error: { code: "NOT_FOUND", message: "API route not found" } }, 404));

  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json({ error: { code: error.code, message: error.message, details: error.details } }, error.status as 400);
    }
    if (error instanceof z.ZodError) {
      return context.json({ error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: error.flatten() } }, 422);
    }
    console.error(error);
    return context.json({ error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred" } }, 500);
  });

  return app;
}
