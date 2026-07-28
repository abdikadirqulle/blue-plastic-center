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
  "sales-by-item",
  "sales-by-customer",
  "invoice-list",
  "collections",
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
            row.occurredAt.slice(0, 10) <= parameters.to).map((row) => ({
              date: row.occurredAt,
              action: row.action,
              activity: row.entityType.replace("/", " / "),
            })),
        },
      })
    }
    if (["sales-by-item", "sales-by-customer", "invoice-list", "collections"].includes(request.params.kind)) {
      const [invoices, items, customers, payments] = await Promise.all([
        resources.list(request.requestContext, "sales", "invoices", { page: 1, pageSize: 100, order: "desc" }),
        resources.list(request.requestContext, "inventory", "items", { page: 1, pageSize: 100, order: "desc" }),
        resources.list(request.requestContext, "sales", "customers", { page: 1, pageSize: 100, order: "desc" }),
        resources.list(request.requestContext, "sales", "payments", { page: 1, pageSize: 100, order: "desc" }),
      ])
      const itemNames = new Map(items.data.map((record) => [record.id, String(record.data.name ?? record.data.displayName ?? "Item")]))
      const customerNames = new Map(customers.data.map((record) => [record.id, String(record.data.displayName ?? record.data.customerName ?? record.data.companyName ?? "Customer")]))
      const invoiceNumbers = new Map(invoices.data.map((record) => [record.id, String(record.data.documentNumber ?? "Invoice")]))
      let rows: Array<Record<string, unknown>> = []
      if (request.params.kind === "sales-by-item") {
        const totals = new Map<string, { item: string; quantity: number; sales: number }>()
        for (const invoice of invoices.data) {
          if (String(invoice.data.invoiceDate ?? "").slice(0, 10) < parameters.from || String(invoice.data.invoiceDate ?? "").slice(0, 10) > parameters.to) continue
          for (const line of Array.isArray(invoice.data.lines) ? invoice.data.lines as Array<Record<string, unknown>> : []) {
            const item = itemNames.get(String(line.itemId)) ?? String(line.description ?? "Unspecified item")
            const current = totals.get(item) ?? { item, quantity: 0, sales: 0 }
            current.quantity += Number(line.quantity ?? 0)
            current.sales += Number(line.quantity ?? 0) * Number(line.unitPrice ?? 0)
            totals.set(item, current)
          }
        }
        rows = [...totals.values()].map((row) => ({ item: row.item, quantitySold: row.quantity.toFixed(2), salesAmount: row.sales.toFixed(2) }))
      } else if (request.params.kind === "sales-by-customer") {
        const totals = new Map<string, { customer: string; invoices: number; sales: number; balance: number }>()
        for (const invoice of invoices.data) {
          if (String(invoice.data.invoiceDate ?? "").slice(0, 10) < parameters.from || String(invoice.data.invoiceDate ?? "").slice(0, 10) > parameters.to) continue
          const customer = customerNames.get(String(invoice.data.customerId)) ?? String(invoice.data.customerName ?? "Unspecified customer")
          const current = totals.get(customer) ?? { customer, invoices: 0, sales: 0, balance: 0 }
          current.invoices += 1
          current.sales += Number(invoice.data.total ?? 0)
          current.balance += Number(invoice.data.balanceDue ?? 0)
          totals.set(customer, current)
        }
        rows = [...totals.values()].map((row) => ({ customer: row.customer, invoiceCount: row.invoices, totalSales: row.sales.toFixed(2), balanceDue: row.balance.toFixed(2) }))
      } else if (request.params.kind === "invoice-list") {
        rows = invoices.data.filter((invoice) => String(invoice.data.invoiceDate ?? "").slice(0, 10) >= parameters.from && String(invoice.data.invoiceDate ?? "").slice(0, 10) <= parameters.to).map((invoice) => ({
          invoice: invoice.data.documentNumber,
          customer: customerNames.get(String(invoice.data.customerId)) ?? invoice.data.customerName ?? "Unspecified customer",
          date: invoice.data.invoiceDate,
          dueDate: invoice.data.dueDate,
          status: invoice.status,
          total: invoice.data.total,
          balanceDue: invoice.data.balanceDue,
        }))
      } else {
        rows = payments.data.filter((payment) => String(payment.data.paymentDate ?? "").slice(0, 10) >= parameters.from && String(payment.data.paymentDate ?? "").slice(0, 10) <= parameters.to).map((payment) => ({
          payment: payment.data.documentNumber,
          customer: customerNames.get(String(payment.data.customerId)) ?? payment.data.customerName ?? "Unspecified customer",
          date: payment.data.paymentDate,
          method: payment.data.paymentMethod,
          reference: payment.data.reference,
          amount: payment.data.amount,
          appliedTo: Array.isArray(payment.data.allocations) ? (payment.data.allocations as Array<Record<string, unknown>>).map((allocation) => invoiceNumbers.get(String(allocation.invoiceId)) ?? "Invoice").join(", ") : "Unapplied",
        }))
      }
      return reply.code(201).send({ data: { reportId: randomUUID(), kind: request.params.kind, status: "generated", parameters, generatedAt: new Date().toISOString(), rows } })
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
      const [customers, vendors, invoices, bills, items] = await Promise.all([
        resources.list(request.requestContext, "sales", "customers", { page: 1, pageSize: 100, order: "desc" }),
        resources.list(request.requestContext, "purchasing", "vendors", { page: 1, pageSize: 100, order: "desc" }),
        resources.list(request.requestContext, "sales", "invoices", { page: 1, pageSize: 100, order: "desc" }),
        resources.list(request.requestContext, "purchasing", "bills", { page: 1, pageSize: 100, order: "desc" }),
        resources.list(request.requestContext, "inventory", "items", { page: 1, pageSize: 100, order: "desc" }),
      ])
      const names = new Map([
        ...customers.data.map((record) => [record.id, record.data.displayName ?? record.data.customerName ?? record.data.companyName]),
        ...vendors.data.map((record) => [record.id, record.data.displayName ?? record.data.vendorName ?? record.data.companyName]),
        ...invoices.data.map((record) => [record.id, record.data.documentNumber]),
        ...bills.data.map((record) => [record.id, record.data.documentNumber]),
        ...items.data.map((record) => [record.id, record.data.name ?? record.data.displayName]),
      ].map(([id, name]) => [String(id), String(name ?? "Unknown")]))
      const rows = records.data.map((record) => {
        if (request.params.kind.endsWith("-aging")) {
          const partyKey = request.params.kind === "receivables-aging" ? "customerId" : "vendorId"
          const documentKey = request.params.kind === "receivables-aging" ? "invoiceId" : "billId"
          return {
            [request.params.kind === "receivables-aging" ? "customer" : "vendor"]: names.get(String(record.data[partyKey])) ?? "Unknown",
            document: names.get(String(record.data[documentKey])) ?? record.data.documentNumber ?? "—",
            dueDate: record.data.dueDate,
            agingBucket: agingBucket(record.data.dueDate, parameters.to),
            originalAmount: record.data.originalAmount,
            outstanding: record.data.outstanding,
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
