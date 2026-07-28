import { randomUUID } from "node:crypto"
import type { FastifyInstance } from "fastify"
import { z } from "zod"
import type { LedgerRepository, TrialBalanceRow } from "../accounting/ledger-repository.js"
import { decimalToMinor, minorToDecimal } from "../accounting/ledger-math.js"
import { authorizeResource } from "../../platform/auth.js"
import type { ResourceService } from "../../services/resource-service.js"
import type { ResourceRepository } from "../../repositories/resource-repository.js"

const reportSchema = z.object({
  from: z.string().date(),
  to: z.string().date(),
  basis: z.enum(["cash", "accrual"]).default("accrual"),
  currency: z.string().length(3).default("USD"),
})

const supportedReports = new Set([
  "trial-balance",
  "general-ledger",
  "profit-and-loss",
  "balance-sheet",
  "cash-flow",
  "receivables-aging",
  "payables-aging",
  "inventory-valuation",
  "tax-summary",
  "audit-trail",
])

function agingBucket(dueDate: unknown, asOf: string) {
  const days = Math.floor(
    (new Date(asOf).getTime() - new Date(String(dueDate)).getTime()) / 86_400_000,
  )
  if (days <= 0) return "current"
  if (days <= 30) return "1-30"
  if (days <= 60) return "31-60"
  if (days <= 90) return "61-90"
  return "90+"
}

function filterRows(kind: string, rows: TrialBalanceRow[]) {
  if (kind === "profit-and-loss") {
    return rows.filter((row) => ["income", "expense", "cost-of-goods-sold"].includes(row.accountType ?? ""))
  }
  if (kind === "balance-sheet") {
    return rows.filter((row) => ["asset", "liability", "equity"].includes(row.accountType ?? ""))
  }
  if (kind === "cash-flow") {
    return rows.filter((row) => row.accountType === "asset" && /cash|bank/i.test(row.accountName ?? row.accountId))
  }
  return rows
}

export async function reportRoutes(
  app: FastifyInstance,
  ledger: LedgerRepository,
  resources: ResourceService,
  repository: ResourceRepository,
) {
  app.post<{ Params: { kind: string } }>("/reports/:kind/run", async (request, reply) => {
    authorizeResource(request.requestContext.principal, "read", "accounting")
    if (!supportedReports.has(request.params.kind)) {
      return reply.code(404).send({ error: { code: "REPORT_NOT_FOUND", message: "Unknown financial report" } })
    }
    const parameters = reportSchema.parse(request.body)
    if (request.params.kind === "audit-trail") {
      const rows = await repository.listAudit(request.requestContext.companyId, 500)
      return reply.code(201).send({
        data: {
          reportId: randomUUID(),
          kind: request.params.kind,
          status: "generated",
          parameters,
          generatedAt: new Date().toISOString(),
          rows: rows.filter((row) =>
            row.occurredAt.slice(0, 10) >= parameters.from &&
            row.occurredAt.slice(0, 10) <= parameters.to),
        },
      })
    }
    const operationalSource: Record<string, [string, string]> = {
      "receivables-aging": ["debts", "receivables"],
      "payables-aging": ["debts", "payables"],
      "inventory-valuation": ["inventory", "stock-levels"],
      "tax-summary": ["sales", "invoices"],
    }
    const source = operationalSource[request.params.kind]
    if (source) {
      const records = await resources.list(
        request.requestContext,
        source[0],
        source[1],
        { page: 1, pageSize: 100, order: "desc" },
      )
      const rows = records.data.map((record) => {
        if (request.params.kind.endsWith("-aging")) {
          return {
            id: record.id,
            ...record.data,
            agingBucket: agingBucket(record.data.dueDate, parameters.to),
          }
        }
        if (request.params.kind === "inventory-valuation") {
          const value =
            (decimalToMinor(record.data.quantity) *
              decimalToMinor(record.data.averageCost)) /
            10_000n
          return { id: record.id, ...record.data, inventoryValue: minorToDecimal(value) }
        }
        return { id: record.id, ...record.data }
      })
      return reply.code(201).send({
        data: {
          reportId: randomUUID(),
          kind: request.params.kind,
          status: "generated",
          parameters,
          generatedAt: new Date().toISOString(),
          rows,
        },
      })
    }
    const reportFrom = request.params.kind === "balance-sheet"
      ? "2000-01-01"
      : parameters.from
    const rows = filterRows(
      request.params.kind,
      await ledger.trialBalance(request.requestContext.companyId, reportFrom, parameters.to),
    )
    const totals = rows.reduce((result, row) => ({
      debit: result.debit + decimalToMinor(row.debit),
      credit: result.credit + decimalToMinor(row.credit),
    }), { debit: 0n, credit: 0n })
    return reply.code(201).send({
      data: {
        reportId: randomUUID(),
        kind: request.params.kind,
        status: "generated",
        parameters,
        generatedAt: new Date().toISOString(),
        rows,
        controlTotals: {
          debit: minorToDecimal(totals.debit),
          credit: minorToDecimal(totals.credit),
          balanced: totals.debit === totals.credit,
        },
      },
    })
  })
}
