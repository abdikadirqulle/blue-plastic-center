import type { FastifyInstance } from "fastify"
import { authorizeResource } from "../../platform/auth.js"
import type { ResourceService } from "../../services/resource-service.js"
import { decimalToMinor, minorToDecimal } from "../accounting/ledger-math.js"
import { conflict } from "../../platform/errors.js"

export async function payrollRoutes(
  app: FastifyInstance,
  resources: ResourceService,
) {
  app.post<{ Params: { id: string } }>(
    "/pay-runs/:id/approve",
    async (request) => {
      authorizeResource(request.requestContext.principal, "approve", "payroll")
      const payRun = await resources.get(
        request.requestContext,
        "payroll",
        "pay-runs",
        request.params.id,
      )
      const lines = payRun.data.lines as Array<Record<string, unknown>>
      const gross = minorToDecimal(
        lines.reduce(
          (total, line) => total + decimalToMinor(line.grossPay),
          0n,
        ),
      )
      const updated = await resources.update(
        request.requestContext,
        "payroll",
        "pay-runs",
        payRun.id,
        {
          version: payRun.version,
          status: "approved",
          data: {
            approvedAt: new Date().toISOString(),
            workflowUpdatedAt: new Date().toISOString(),
          },
        },
        { allowWorkflowTransition: true },
      )
      await resources.create(
        request.requestContext,
        "accounting",
        "journal-entries",
        {
          status: "draft",
          data: {
            journalDate: payRun.data.paymentDate,
            sourceModule: "payroll",
            sourceId: payRun.id,
            lines: [
              {
                accountId: payRun.data.wageExpenseAccountId,
                debit: gross,
                credit: "0.0000",
              },
              {
                accountId: payRun.data.payrollPayableAccountId,
                debit: "0.0000",
                credit: gross,
              },
            ],
          },
        },
      )
      return { data: updated }
    },
  )

  app.post<{ Params: { id: string } }>(
    "/pay-runs/:id/mark-paid",
    async (request) => {
      authorizeResource(request.requestContext.principal, "post", "payroll")
      const payRun = await resources.get(
        request.requestContext,
        "payroll",
        "pay-runs",
        request.params.id,
      )
      if (payRun.status !== "approved")
        throw conflict("Only approved pay runs can be paid")
      return {
        data: await resources.update(
          request.requestContext,
          "payroll",
          "pay-runs",
          payRun.id,
          {
            version: payRun.version,
            status: "paid",
            data: {
              paidAt: new Date().toISOString(),
              workflowUpdatedAt: new Date().toISOString(),
            },
          },
          { allowWorkflowTransition: true },
        ),
      }
    },
  )
}
