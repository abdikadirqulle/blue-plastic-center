import type { FastifyInstance } from "fastify"
import { authorizeResource } from "../../platform/auth.js"
import type { ResourceService } from "../../services/resource-service.js"
import { decimalToMinor, minorToDecimal } from "../accounting/ledger-math.js"
import { progressBillingSchema } from "./project.schemas.js"

export async function projectRoutes(
  app: FastifyInstance,
  resources: ResourceService,
) {
  app.post<{ Params: { id: string } }>(
    "/progress-billing/:id/create-invoice",
    async (request, reply) => {
      authorizeResource(request.requestContext.principal, "create", "projects")
      const input = progressBillingSchema.parse(request.body)
      const billing = await resources.get(
        request.requestContext,
        "projects",
        "progress-billing",
        request.params.id,
      )
      const invoice = await resources.create(
        request.requestContext,
        "sales",
        "invoices",
        {
          status: "draft",
          data: {
            customerId: billing.data.customerId,
            invoiceDate: billing.data.invoiceDate,
            dueDate: input.dueDate,
            currency: "USD",
            projectId: billing.data.projectId,
            sourceDocumentId: billing.id,
            lines: [
              {
                accountId: billing.data.revenueAccountId,
                description: billing.data.description,
                quantity: "1",
                unitPrice: billing.data.amount,
              },
            ],
          },
        },
      )
      return reply.code(201).send({ data: invoice })
    },
  )

  app.get<{ Params: { id: string } }>(
    "/projects/:id/profitability",
    async (request) => {
      authorizeResource(request.requestContext.principal, "read", "projects")
      const project = await resources.get(
        request.requestContext,
        "projects",
        "projects",
        request.params.id,
      )
      const query = { page: 1, pageSize: 100, order: "desc" as const }
      const [time, expenses, billings] = await Promise.all([
        resources.list(request.requestContext, "projects", "time", query),
        resources.list(request.requestContext, "projects", "expenses", query),
        resources.list(
          request.requestContext,
          "projects",
          "progress-billing",
          query,
        ),
      ])
      const belongs = (record: { data: Record<string, unknown> }) =>
        record.data.projectId === project.id
      const projectTime = time.data.filter(belongs)
      const projectExpenses = expenses.data.filter(belongs)
      const projectBillings = billings.data.filter(belongs)
      const labourCost = projectTime.reduce(
        (total, entry) =>
          total +
          (decimalToMinor(entry.data.hours) *
            decimalToMinor(entry.data.hourlyCost)) /
            10_000n,
        0n,
      )
      const expenseCost = projectExpenses.reduce(
        (total, entry) => total + decimalToMinor(entry.data.amount),
        0n,
      )
      const revenue = projectBillings.reduce(
        (total, entry) => total + decimalToMinor(entry.data.amount),
        0n,
      )
      const totalCost = labourCost + expenseCost
      const profit = revenue - totalCost
      return {
        data: {
          projectId: project.id,
          timeEntries: projectTime.length,
          expenseEntries: projectExpenses.length,
          billingEntries: projectBillings.length,
          revenue: minorToDecimal(revenue),
          labourCost: minorToDecimal(labourCost),
          expenseCost: minorToDecimal(expenseCost),
          totalCost: minorToDecimal(totalCost),
          profit: minorToDecimal(profit),
          marginPercent:
            revenue === 0n
              ? "0.00"
              : `${Number((profit * 10_000n) / revenue) / 100}`,
        },
      }
    },
  )
}
