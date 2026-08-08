import type { FastifyInstance } from "fastify"
import { authorizeResource } from "../../platform/auth.js"
import type { ResourceService } from "../../services/resource-service.js"
import type { OperationalWorkflowService } from "../operations/operational-workflow.service.js"
import { approvalDecisionSchema, receivePurchaseOrderSchema } from "@blue-plastic/types"
import { validation } from "../../platform/errors.js"
import { systemAccountKeys } from "../accounting/system-accounts.js"

export function resolveBillPostingAccounts(lines: Array<Record<string, unknown>>) {
  const expenseAccountIds = [...new Set(lines
    .map((line) => line.accountId)
    .filter((accountId): accountId is string =>
      typeof accountId === "string" && accountId.length > 0
    ))]
  if (expenseAccountIds.length !== 1 || lines.some((line) => !line.accountId)) {
    throw validation(
      "Approved bill requires one configured expense account across all lines",
    )
  }
  return {
    debitAccount: { accountId: expenseAccountIds[0] },
    creditAccount: { systemAccountKey: systemAccountKeys.ACCOUNTS_PAYABLE },
  }
}

export async function purchasingRoutes(
  app: FastifyInstance,
  workflows: OperationalWorkflowService,
  resources: ResourceService,
) {
  app.post<{ Params: { id: string } }>("/purchase-orders/:id/receive", async (request, reply) => {
    authorizeResource(request.requestContext.principal, "create", "purchasing")
    const input = receivePurchaseOrderSchema.parse(request.body)
    return reply.code(201).send({
      data: await workflows.receivePurchaseOrder(request.requestContext, request.params.id, input),
    })
  })

  app.post<{ Params: { id: string } }>("/approvals/:id/decision", async (request) => {
    authorizeResource(request.requestContext.principal, "approve", "purchasing")
    const input = approvalDecisionSchema.parse(request.body)
    const current = await resources.get(request.requestContext, "purchasing", "approvals", request.params.id)
    const approval = await resources.update(request.requestContext, "purchasing", "approvals", current.id, {
        version: current.version,
        status: input.decision,
        data: {
          decision: input.decision,
          decisionNote: input.note,
          workflowUpdatedAt: new Date().toISOString(),
        },
      }, { allowWorkflowTransition: true })
    if (input.decision === "approved" && current.data.documentType === "bills") {
      const bill = await resources.get(
        request.requestContext,
        "purchasing",
        "bills",
        String(current.data.documentId),
      )
      const billLines = bill.data.lines as Array<Record<string, unknown>>
      const postingAccounts = resolveBillPostingAccounts(billLines)
      await workflows.createDraftPosting(
        request.requestContext,
        "purchasing",
        "bills",
        bill.id,
        String(bill.data.billDate),
        billLines,
        postingAccounts.debitAccount,
        postingAccounts.creditAccount,
      )
    }
    return {
      data: approval,
    }
  })
}
