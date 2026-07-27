import type { FastifyInstance } from "fastify"
import { authorizeResource } from "../../platform/auth.js"
import type { OperationalWorkflowService } from "../operations/operational-workflow.service.js"
import {
  allocationSchema,
  conversionSchema,
  emailDocumentSchema,
} from "./sales.schemas.js"
import type { ResourceService } from "../../services/resource-service.js"

export async function salesRoutes(
  app: FastifyInstance,
  workflows: OperationalWorkflowService,
  resources: ResourceService,
) {
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
      const current = await resources.get(
        request.requestContext,
        "sales",
        "payments",
        request.params.id,
      )
      const input = allocationSchema.parse(request.body)
      const payment = await resources.update(
        request.requestContext,
        "sales",
        "payments",
        current.id,
        {
          version: current.version,
          status: "applied",
          data: input,
        },
      )
      const amount = String(current.data.amount)
      await resources.create(
        request.requestContext,
        "accounting",
        "journal-entries",
        {
          status: "draft",
          data: {
            journalDate: current.data.paymentDate,
            sourceModule: "sales",
            sourceResource: "payments",
            sourceId: current.id,
            lines: [
              {
                accountId: current.data.depositToAccountId,
                debit: amount,
                credit: "0.0000",
              },
              {
                accountId: "accounts-receivable",
                debit: "0.0000",
                credit: amount,
              },
            ],
          },
        },
      )
      return {
        data: payment,
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
