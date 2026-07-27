import type { FastifyInstance } from "fastify"
import { authorizeResource } from "../../platform/auth.js"
import { forbidden } from "../../platform/errors.js"
import type { ResourceService } from "../../services/resource-service.js"
import type { LedgerRepository } from "./ledger-repository.js"
import {
  periodSchema,
  reconciliationSchema,
  reverseJournalSchema,
} from "./accounting.schemas.js"
import { decimalToMinor, minorToDecimal } from "./ledger-math.js"

export async function accountingRoutes(
  app: FastifyInstance,
  resources: ResourceService,
  ledger: LedgerRepository,
) {
  app.post<{ Params: { id: string } }>(
    "/journal-entries/:id/post",
    async (request) => {
      authorizeResource(request.requestContext.principal, "post", "accounting")
      const journal = await resources.get(
        request.requestContext,
        "accounting",
        "journal-entries",
        request.params.id,
      )
      return { data: await ledger.postJournal(request.requestContext, journal) }
    },
  )

  app.post<{ Params: { id: string } }>(
    "/journal-entries/:id/reverse",
    async (request, reply) => {
      authorizeResource(request.requestContext.principal, "post", "accounting")
      const input = reverseJournalSchema.parse(request.body)
      const journal = await resources.get(
        request.requestContext,
        "accounting",
        "journal-entries",
        request.params.id,
      )
      return reply.code(201).send({
        data: await ledger.reverseJournal(
          request.requestContext,
          journal,
          input.reversalDate,
          input.memo,
        ),
      })
    },
  )

  app.post("/periods/close", async (request, reply) => {
    authorizeResource(request.requestContext.principal, "approve", "accounting")
    const input = periodSchema.parse(request.body)
    await ledger.closePeriod(request.requestContext, input)
    return reply.code(204).send()
  })

  app.post<{ Params: { name: string } }>(
    "/periods/:name/reopen",
    async (request, reply) => {
      if (request.requestContext.principal.role !== "administrator")
        throw forbidden("Only an administrator can reopen a fiscal period")
      await ledger.reopenPeriod(request.requestContext, request.params.name)
      return reply.code(204).send()
    },
  )

  app.post("/reconciliation/control-accounts", async (request) => {
    authorizeResource(request.requestContext.principal, "read", "accounting")
    const input = reconciliationSchema.parse(request.body)
    const [ledgerRows, receivables, payables] = await Promise.all([
      ledger.trialBalance(request.requestContext.companyId, input.from, input.to),
      resources.list(request.requestContext, "debts", "receivables", {
        page: 1,
        pageSize: 100,
        order: "desc",
      }),
      resources.list(request.requestContext, "debts", "payables", {
        page: 1,
        pageSize: 100,
        order: "desc",
      }),
    ])
    const ledgerBalance = (accountNumber: string) =>
      decimalToMinor(
        ledgerRows.find((row) => row.accountNumber === accountNumber)?.balance,
      )
    const controls = [
      {
        controlAccount: "1100",
        subledger: "receivables",
        ledgerBalance: ledgerBalance("1100"),
        subledgerBalance: receivables.data.reduce(
          (total, record) => total + decimalToMinor(record.data.outstanding),
          0n,
        ),
      },
      {
        controlAccount: "2000",
        subledger: "payables",
        ledgerBalance: -ledgerBalance("2000"),
        subledgerBalance: payables.data.reduce(
          (total, record) => total + decimalToMinor(record.data.outstanding),
          0n,
        ),
      },
    ].map((control) => ({
      controlAccount: control.controlAccount,
      subledger: control.subledger,
      ledgerBalance: minorToDecimal(control.ledgerBalance),
      subledgerBalance: minorToDecimal(control.subledgerBalance),
      variance: minorToDecimal(
        control.ledgerBalance - control.subledgerBalance,
      ),
      reconciled: control.ledgerBalance === control.subledgerBalance,
    }))
    return { data: { ...input, controls } }
  })
}
