import type { FastifyInstance } from "fastify"
import { authorizeResource } from "../../platform/auth.js"
import type { OperationalWorkflowService } from "../operations/operational-workflow.service.js"
import { fulfillmentActionSchema } from "@blue-plastic/types"

const actionStatus = {
  allocate: "allocated",
  pick: "picked",
  pack: "packed",
  ship: "shipped",
} as const

export async function inventoryRoutes(
  app: FastifyInstance,
  workflows: OperationalWorkflowService,
) {
  app.post<{ Params: { id: string } }>(
    "/fulfillment/:id/action",
    async (request) => {
      authorizeResource(request.requestContext.principal, "update", "inventory")
      const input = fulfillmentActionSchema.parse(request.body)
      return {
        data: await workflows.transition(
          request.requestContext,
          "inventory",
          "fulfillment",
          request.params.id,
          actionStatus[input.action],
          input,
        ),
      }
    },
  )
}
