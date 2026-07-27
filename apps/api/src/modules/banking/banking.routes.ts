import type { FastifyInstance } from "fastify"
import { authorizeResource } from "../../platform/auth.js"
import type { ResourceService } from "../../services/resource-service.js"
import type { OperationalWorkflowService } from "../operations/operational-workflow.service.js"
import {
  feedActionSchema,
  reconciliationFinishSchema,
} from "./banking.schemas.js"

const feedStatus = {
  match: "matched",
  add: "added",
  exclude: "excluded",
} as const

export async function bankingRoutes(
  app: FastifyInstance,
  workflows: OperationalWorkflowService,
  resources: ResourceService,
) {
  app.post<{ Params: { id: string } }>(
    "/bank-feeds/:id/action",
    async (request) => {
      authorizeResource(request.requestContext.principal, "update", "banking")
      const input = feedActionSchema.parse(request.body)
      return {
        data: await workflows.transition(
          request.requestContext,
          "banking",
          "bank-feeds",
          request.params.id,
          feedStatus[input.action],
          input,
        ),
      }
    },
  )

  app.post<{ Params: { id: string } }>(
    "/reconciliation/:id/finish",
    async (request) => {
      authorizeResource(request.requestContext.principal, "post", "banking")
      const input = reconciliationFinishSchema.parse(request.body)
      return {
        data: await workflows.transition(
          request.requestContext,
          "banking",
          "reconciliation",
          request.params.id,
          "reconciled",
          input,
        ),
      }
    },
  )

  app.post<{ Params: { id: string } }>(
    "/bank-rules/:id/apply",
    async (request) => {
      authorizeResource(request.requestContext.principal, "update", "banking")
      const rule = await resources.get(
        request.requestContext,
        "banking",
        "bank-rules",
        request.params.id,
      )
      return {
        data: { ruleId: rule.id, status: "applied", matchedTransactions: 0 },
      }
    },
  )
}
