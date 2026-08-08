import type { FastifyInstance } from "fastify"
import { createHash } from "node:crypto"
import { authorizeResource } from "../../platform/auth.js"
import type { OperationalWorkflowService } from "../operations/operational-workflow.service.js"
import {
  conversionSchema,
  emailDocumentSchema,
} from "@blue-plastic/types"
import type { ResourceService } from "../../services/resource-service.js"
import { listQuerySchema, writeSchema } from "../resources/resource.schemas.js"
import type { InvoiceService } from "./invoice-service.js"
import type { CustomerPaymentService } from "./customer-payment-service.js"

export async function salesRoutes(
  app: FastifyInstance,
  workflows: OperationalWorkflowService,
  resources: ResourceService,
  invoices: InvoiceService,
  payments: CustomerPaymentService,
) {
  app.get("/invoices", async (request) => {
    authorizeResource(request.requestContext.principal, "read", "sales")
    const query = listQuerySchema.parse(request.query)
    const result = await invoices.list(request.requestContext, query)
    return {
      data: result.data,
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.ceil(result.total / query.pageSize),
      },
    }
  })

  app.get<{ Params: { id: string } }>("/invoices/:id", async (request) => {
    authorizeResource(request.requestContext.principal, "read", "sales")
    return { data: await invoices.get(request.requestContext, request.params.id) }
  })

  app.post("/invoices", async (request, reply) => {
    authorizeResource(request.requestContext.principal, "create", "sales")
    const input = writeSchema.parse(request.body)
    const idempotencyKey = request.headers["idempotency-key"]
    const options = typeof idempotencyKey === "string"
      ? {
          idempotencyKey,
          requestHash: createHash("sha256")
            .update(JSON.stringify(input))
            .digest("hex"),
        }
      : undefined
    const invoice = await invoices.create(request.requestContext, input, options)
    return reply
      .header("Location", `/v1/sales/invoices/${invoice.id}`)
      .code(201)
      .send({ data: invoice })
  })

  app.patch<{ Params: { id: string } }>("/invoices/:id", async (request) => {
    authorizeResource(request.requestContext.principal, "update", "sales")
    return {
      data: await invoices.update(
        request.requestContext,
        request.params.id,
        writeSchema.parse(request.body),
      ),
    }
  })

  app.post<{ Params: { id: string } }>("/invoices/:id/post", async (request) => {
    authorizeResource(request.requestContext.principal, "post", "sales")
    const idempotencyKey = request.headers["idempotency-key"]
    return {
      data: await invoices.post(
        request.requestContext,
        request.params.id,
        typeof idempotencyKey === "string" ? idempotencyKey : "",
      ),
    }
  })

  app.post<{ Params: { id: string } }>("/invoices/:id/void", async (request) => {
    authorizeResource(request.requestContext.principal, "post", "sales")
    const idempotencyKey = request.headers["idempotency-key"]
    return {
      data: await invoices.void(
        request.requestContext,
        request.params.id,
        request.body,
        typeof idempotencyKey === "string" ? idempotencyKey : "",
      ),
    }
  })

  app.delete<{ Params: { id: string } }>("/invoices/:id", async (request, reply) => {
    authorizeResource(request.requestContext.principal, "delete", "sales")
    await invoices.remove(request.requestContext, request.params.id)
    return reply.code(204).send()
  })

  app.post<{ Params: { resource: string; id: string } }>(
    "/:resource/:id/convert",
    async (request, reply) => {
      authorizeResource(request.requestContext.principal, "create", "sales")
      const { targetResource } = conversionSchema.parse(request.body)
      const record = await workflows.convertSalesDocument(
        request.requestContext,
        request.params.resource,
        request.params.id,
        targetResource,
      )
      return reply.code(201).send({ data: record })
    },
  )

  app.post<{ Params: { id: string } }>(
    "/payments/:id/allocate",
    async (request) => {
      authorizeResource(request.requestContext.principal, "update", "sales")
      return {
        data: await payments.allocate(
          request.requestContext,
          request.params.id,
          request.body,
        ),
      }
    },
  )

  app.post<{ Params: { id: string } }>(
    "/payments/:id/post",
    async (request) => {
      authorizeResource(request.requestContext.principal, "post", "sales")
      const idempotencyKey = request.headers["idempotency-key"]
      return {
        data: await payments.post(
          request.requestContext,
          request.params.id,
          typeof idempotencyKey === "string" ? idempotencyKey : "",
        ),
      }
    },
  )

  app.post<{ Params: { resource: string; id: string } }>(
    "/:resource/:id/email",
    async (request, reply) => {
      authorizeResource(request.requestContext.principal, "read", "sales")
      await resources.get(
        request.requestContext,
        "sales",
        request.params.resource,
        request.params.id,
      )
      const input = emailDocumentSchema.parse(request.body)
      const job = await resources.create(
        request.requestContext,
        "documents",
        "email-jobs",
        {
          status: "queued",
          data: {
            ...input,
            entityModule: "sales",
            entityResource: request.params.resource,
            entityId: request.params.id,
          },
        },
      )
      return reply.code(202).send({
        data: job,
      })
    },
  )
}
