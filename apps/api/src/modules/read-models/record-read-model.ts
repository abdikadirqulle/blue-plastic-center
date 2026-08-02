import type {
  ActivityMetric,
  ActivityRow,
  RecordActivity,
} from "@blue-plastic/types"
import type {
  ListQuery,
  RequestContext,
  ResourceRecord,
} from "../../platform/types.js"
import type { ResourceRepository } from "../../repositories/resource-repository.js"
import type { LedgerRepository } from "../accounting/ledger-repository.js"
import { decimalToMinor, minorToDecimal } from "../accounting/ledger-math.js"
import type { InventoryReadPort } from "../inventory/inventory-movement-port.js"
import { lineAmount, sumLineAmounts } from "../operations/money.js"
import type { InvoiceRepository } from "../sales/invoice-repository.js"
import {
  addDecimals,
  averageCost,
  naturalBalance,
  netPayments,
  outstandingAfterAllocations,
  runningLedgerBalance,
  summarizeParty,
  unappliedAmount,
  type PartyDocument,
} from "./balance-math.js"

/**
 * Adds server-calculated figures to records before they leave the API.
 *
 * A stored record only holds what a form captured. Balances belong to the
 * ledger and the subledgers, so they are read from there on every request
 * instead of being written onto the customer, item or account. A screen can
 * therefore never show a balance that the books disagree with.
 */
export interface RecordEnricher {
  enrich(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    records: ResourceRecord[],
  ): Promise<ResourceRecord[]>
}

/** Reference fields a document may carry, and the list that resolves them. */
const referenceSources = {
  customerId: { module: "sales", resource: "customers", target: "customerName" },
  vendorId: { module: "purchasing", resource: "vendors", target: "vendorName" },
  itemId: { module: "inventory", resource: "items", target: "itemName" },
  accountId: {
    module: "accounting",
    resource: "chart-of-accounts",
    target: "accountName",
  },
  bankAccount: {
    module: "accounting",
    resource: "chart-of-accounts",
    target: "bankAccountName",
  },
  paymentAccountId: {
    module: "accounting",
    resource: "chart-of-accounts",
    target: "paymentAccountName",
  },
  depositToAccountId: {
    module: "accounting",
    resource: "chart-of-accounts",
    target: "depositToAccountName",
  },
  expenseAccountId: {
    module: "accounting",
    resource: "chart-of-accounts",
    target: "expenseAccountName",
  },
  receivableAccountId: {
    module: "accounting",
    resource: "chart-of-accounts",
    target: "receivableAccountName",
  },
  payableAccountId: {
    module: "accounting",
    resource: "chart-of-accounts",
    target: "payableAccountName",
  },
} as const;

const listAll: ListQuery = { page: 1, pageSize: 500, order: "desc" }

/**
 * Where a posting or a stock movement came from, expressed as a screen. A
 * source without an entry here — an opening balance, for example — is shown as
 * text rather than a link to a page that does not exist.
 */
const sourceScreens: Record<string, { module: string; resource: string }> = {
  invoice: { module: "sales", resource: "invoices" },
  sales_receipt: { module: "sales", resource: "sales-receipts" },
  payment: { module: "sales", resource: "payments" },
  bill: { module: "purchasing", resource: "bills" },
  bill_payment: { module: "purchasing", resource: "bill-payments" },
  expense: { module: "purchasing", resource: "expenses" },
  journal: { module: "accounting", resource: "journal-entries" },
  journal_entry: { module: "accounting", resource: "journal-entries" },
  adjustment: { module: "inventory", resource: "adjustments" },
}

/** `opening_balance` is a database value; "Opening balance" is a column entry. */
function sourceLabel(sourceType: string) {
  return sourceType
    .replace(/[_-]/g, " ")
    .replace(/^./, (character) => character.toUpperCase())
}

function sourceLink(sourceType: string, id: string | undefined) {
  const screen = sourceScreens[sourceType]
  if (!screen || !id) return {}
  return { source: { ...screen, id } }
}

const today = () => new Date().toISOString().slice(0, 10)

function recordName(record: ResourceRecord) {
  const data = record.data
  return String(
    data.displayName ??
      data.name ??
      data.accountName ??
      data.documentNumber ??
      record.id,
  )
}

/**
 * A posting line names an account by id, by number or by system key, so a
 * balance is the total of every trial-balance row under any of those names.
 */
function accountAliases(record: ResourceRecord) {
  return [
    record.id,
    String(record.data.accountNumber ?? ""),
    String(record.data.systemKey ?? ""),
  ].filter(Boolean)
}

function withData(record: ResourceRecord, extra: Record<string, unknown>) {
  return { ...record, data: { ...record.data, ...extra } }
}

const metric = (
  key: string,
  value: string,
  format: ActivityMetric["format"],
): ActivityMetric => ({ key, value, format })

export class RecordReadModel implements RecordEnricher {
  constructor(
    private readonly resources: ResourceRepository,
    private readonly ledger: LedgerRepository,
    private readonly invoices?: InvoiceRepository,
    private readonly inventory?: InventoryReadPort,
  ) {}

  async enrich(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    records: ResourceRecord[],
  ) {
    if (!records.length) return records
    const key = `${moduleName}/${resourceName}`
    if (key === "sales/customers") return this.withCustomerBalances(context, records)
    if (key === "purchasing/vendors") return this.withVendorBalances(context, records)
    if (key === "inventory/items") return this.withStockOnHand(context, records)
    if (key === "accounting/chart-of-accounts")
      return this.withAccountBalances(context, records)
    const named = await this.withReferenceNames(context, records)
    return named.map(withLineTotal)
  }

  /** Everything a detail screen shows beyond the record's own fields. */
  async activity(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    record: ResourceRecord,
  ): Promise<RecordActivity> {
    const events = await this.resources.listAuditFor(
      context.companyId,
      `${moduleName}/${resourceName}`,
      record.id,
      50,
    )
    const audit = events.map((event) => ({
      action: event.action,
      occurredAt: event.occurredAt,
      userId: event.userId,
    }))
    const currency = String(record.data.currency ?? "USD")
    const key = `${moduleName}/${resourceName}`
    if (key === "sales/customers")
      return { ...(await this.customerActivity(context, record)), currency, audit }
    if (key === "purchasing/vendors")
      return { ...(await this.vendorActivity(context, record)), currency, audit }
    if (key === "inventory/items")
      return { ...(await this.itemActivity(context, record)), currency, audit }
    if (key === "accounting/chart-of-accounts")
      return { ...(await this.accountActivity(context, record)), currency, audit }
    return { kind: "none", currency, metrics: [], rows: [], audit }
  }

  private async withCustomerBalances(
    context: RequestContext,
    records: ResourceRecord[],
  ) {
    if (!this.invoices) return records
    const documents = await this.invoices.listByCustomers(
      context,
      records.map((record) => record.id),
    )
    const payments = await this.listRecords(context, "sales", "payments")
    const allocated = allocationsByDocument(payments)
    const asOf = today()
    return records.map((record) => {
      const balance = netPayments(
        summarizeParty(
          documents
            .filter((document) => document.customerId === record.id)
            .map((document) => toPartyDocument(document, allocated)),
          asOf,
        ),
        paymentAmounts(payments, "customerId", record.id),
      )
      return withData(record, {
        openBalance: balance.openBalance,
        overdueBalance: balance.overdueBalance,
        openInvoices: balance.openCount,
        lastInvoiceDate: balance.lastDocumentDate,
      })
    })
  }

  /**
   * Bills never reach the ledger yet, so a vendor shows what is recorded and
   * unpaid rather than a posted payable. Drafts are counted because a bill has
   * no posting step to exclude them by.
   */
  private async withVendorBalances(
    context: RequestContext,
    records: ResourceRecord[],
  ) {
    const [bills, payments] = await Promise.all([
      this.listRecords(context, "purchasing", "bills"),
      this.listRecords(context, "purchasing", "bill-payments"),
    ])
    const allocated = allocationsByDocument(payments)
    const asOf = today()
    return records.map((record) => {
      const balance = netPayments(
        summarizeParty(
          bills
            .filter((bill) => String(bill.data.vendorId ?? "") === record.id)
            .map((bill) => toBillDocument(bill, allocated)),
          asOf,
          { includeDrafts: true },
        ),
        paymentAmounts(payments, "vendorId", record.id),
      )
      return withData(record, {
        openBalance: balance.openBalance,
        overdueBalance: balance.overdueBalance,
        openBills: balance.openCount,
        lastBillDate: balance.lastDocumentDate,
      })
    })
  }

  private async withStockOnHand(
    context: RequestContext,
    records: ResourceRecord[],
  ) {
    if (!this.inventory) return records
    const levels = await this.inventory.stockLevels(
      context,
      records.map((record) => record.id),
    )
    const byItem = new Map(levels.map((level) => [level.itemId, level]))
    return records.map((record) => {
      const level = byItem.get(record.id)
      const quantity = level?.quantity ?? "0.0000"
      const value = level?.inventoryValue ?? "0.0000"
      return withData(record, {
        quantityOnHand: quantity,
        inventoryValue: value,
        averageCost: averageCost(quantity, value),
      })
    })
  }

  private async withAccountBalances(
    context: RequestContext,
    records: ResourceRecord[],
  ) {
    const rows = await this.ledger.trialBalance(
      context.companyId,
      "1900-01-01",
      today(),
    )
    const byAccount = new Map(rows.map((row) => [row.accountId, row]))
    return records.map((record) => {
      const accountType = String(record.data.accountType ?? "")
      const totals = accountAliases(record)
        .map((alias) => byAccount.get(alias))
        .reduce(
          (result, row) => ({
            debit: result.debit + decimalToMinor(row?.debit ?? "0"),
            credit: result.credit + decimalToMinor(row?.credit ?? "0"),
          }),
          { debit: 0n, credit: 0n },
        )
      return withData(record, {
        balance: naturalBalance(
          accountType,
          minorToDecimal(totals.debit),
          minorToDecimal(totals.credit),
        ),
        debitTotal: minorToDecimal(totals.debit),
        creditTotal: minorToDecimal(totals.credit),
      })
    })
  }

  /**
   * Replaces the identifiers a document stores with the names a person reads.
   * Only the lists a document actually references are loaded.
   */
  private async withReferenceNames(
    context: RequestContext,
    records: ResourceRecord[],
  ) {
    const needed = Object.entries(referenceSources).filter(([field, source]) =>
      records.some(
        (record) =>
          record.data[field] !== undefined &&
          record.data[field] !== "" &&
          record.data[source.target] === undefined,
      ),
    )
    if (!needed.length) return records
    const caches = new Map<string, Map<string, string>>()
    for (const [, source] of needed) {
      const key = `${source.module}/${source.resource}`
      if (caches.has(key)) continue
      const referenced = await this.listRecords(
        context,
        source.module,
        source.resource,
      )
      caches.set(
        key,
        new Map(referenced.map((record) => [record.id, recordName(record)])),
      )
    }
    return records.map((record) => {
      const resolved: Record<string, unknown> = {}
      for (const [field, source] of needed) {
        const id = record.data[field]
        if (typeof id !== "string" || !id) continue
        const name = caches.get(`${source.module}/${source.resource}`)?.get(id)
        if (name) resolved[source.target] = name
      }
      return Object.keys(resolved).length ? withData(record, resolved) : record
    })
  }

  private async customerActivity(
    context: RequestContext,
    record: ResourceRecord,
  ) {
    if (!this.invoices)
      return { kind: "customer" as const, metrics: [], rows: [] }
    const invoices = await this.invoices.listByCustomers(context, [record.id])
    const [paymentRecords, receiptRecords] = await Promise.all([
      this.listRecords(context, "sales", "payments"),
      this.listRecords(context, "sales", "sales-receipts"),
    ])
    const forCustomer = (candidate: ResourceRecord) =>
      String(candidate.data.customerId ?? "") === record.id
    const payments = paymentRecords.filter(forCustomer)
    const receipts = receiptRecords.filter(forCustomer)
    const allocated = allocationsByDocument(payments)
    const balance = netPayments(
      summarizeParty(
        invoices.map((invoice) => toPartyDocument(invoice, allocated)),
        today(),
      ),
      activeAmounts(payments),
    )
    const rows: ActivityRow[] = [
      ...invoices.map((invoice) => ({
        id: invoice.id,
        date: invoice.invoiceDate,
        kind: "invoice" as const,
        reference: invoice.invoiceNumber,
        description: `Due ${invoice.dueDate}`,
        status: invoice.status,
        amount: invoice.total,
        affectsBalance: isPosted(invoice.status),
        source: { module: "sales", resource: "invoices", id: invoice.id },
      })),
      ...payments.map((payment) => ({
        id: payment.id,
        date: String(payment.data.paymentDate ?? payment.createdAt.slice(0, 10)),
        kind: "payment" as const,
        reference: String(payment.data.documentNumber ?? payment.id.slice(0, 8)),
        description: String(payment.data.paymentMethod ?? "Payment received"),
        status: payment.status,
        amount: `-${String(payment.data.amount ?? "0")}`,
        affectsBalance: isPosted(payment.status),
        source: { module: "sales", resource: "payments", id: payment.id },
      })),
      ...receipts.map((receipt) => ({
        id: receipt.id,
        date: String(receipt.data.saleDate ?? receipt.createdAt.slice(0, 10)),
        kind: "receipt" as const,
        reference: String(receipt.data.documentNumber ?? receipt.id.slice(0, 8)),
        description: String(receipt.data.paymentMethod ?? "Cash sale"),
        status: receipt.status,
        amount: String(receipt.data.total ?? receipt.data.amount ?? "0"),
        affectsBalance: false,
        source: { module: "sales", resource: "sales-receipts", id: receipt.id },
      })),
    ]
    return {
      kind: "customer" as const,
      metrics: [
        metric("openBalance", balance.openBalance, "money"),
        metric("overdueBalance", balance.overdueBalance, "money"),
        metric("openInvoices", String(balance.openCount), "count"),
        metric("lastInvoiceDate", balance.lastDocumentDate ?? "—", "date"),
      ],
      rows: withRunningTotal(rows),
    }
  }

  private async vendorActivity(context: RequestContext, record: ResourceRecord) {
    const bills = (await this.listRecords(context, "purchasing", "bills")).filter(
      (bill) => String(bill.data.vendorId ?? "") === record.id,
    )
    const payments = (
      await this.listRecords(context, "purchasing", "bill-payments")
    ).filter((payment) => String(payment.data.vendorId ?? "") === record.id)
    const allocated = allocationsByDocument(payments)
    const balance = netPayments(
      summarizeParty(
        bills.map((bill) => toBillDocument(bill, allocated)),
        today(),
        { includeDrafts: true },
      ),
      activeAmounts(payments),
    )
    const rows: ActivityRow[] = [
      ...bills.map((bill) => ({
        id: bill.id,
        date: String(bill.data.billDate ?? bill.createdAt.slice(0, 10)),
        kind: "bill" as const,
        reference: String(bill.data.documentNumber ?? bill.data.billNumber ?? "—"),
        description: bill.data.dueDate ? `Due ${String(bill.data.dueDate)}` : "",
        status: bill.status,
        amount: String(billTotal(bill)),
        affectsBalance: !voidedStatuses.has(bill.status.toLowerCase()),
        source: { module: "purchasing", resource: "bills", id: bill.id },
      })),
      ...payments.map((payment) => ({
        id: payment.id,
        date: String(payment.data.paymentDate ?? payment.createdAt.slice(0, 10)),
        kind: "payment" as const,
        reference: String(payment.data.documentNumber ?? payment.id.slice(0, 8)),
        description: String(payment.data.paymentMethod ?? "Payment sent"),
        status: payment.status,
        amount: `-${String(payment.data.amount ?? "0")}`,
        affectsBalance: isPosted(payment.status),
        source: {
          module: "purchasing",
          resource: "bill-payments",
          id: payment.id,
        },
      })),
    ]
    return {
      kind: "vendor" as const,
      metrics: [
        metric("openBalance", balance.openBalance, "money"),
        metric("overdueBalance", balance.overdueBalance, "money"),
        metric("openBills", String(balance.openCount), "count"),
        metric("lastBillDate", balance.lastDocumentDate ?? "—", "date"),
      ],
      rows: withRunningTotal(rows),
    }
  }

  private async itemActivity(context: RequestContext, record: ResourceRecord) {
    if (!this.inventory) return { kind: "item" as const, metrics: [], rows: [] }
    const [levels, movements] = await Promise.all([
      this.inventory.stockLevels(context, [record.id]),
      this.inventory.listByItem(context, record.id, 100),
    ])
    const quantity = levels[0]?.quantity ?? "0.0000"
    const value = levels[0]?.inventoryValue ?? "0.0000"
    const rows: ActivityRow[] = movements
      .map((movement) => ({
        id: movement.id,
        date: movement.occurredAt.slice(0, 10),
        kind: "movement" as const,
        reference: sourceLabel(movement.sourceType),
        description: sourceLabel(movement.kind),
        quantity: movement.quantityDelta,
        unitCost: movement.unitCost,
        amount: movement.valueDelta,
        running: movement.quantityAfter,
        ...sourceLink(movement.sourceType, movement.sourceId),
      }))
      .reverse()
    return {
      kind: "item" as const,
      metrics: [
        metric("quantityOnHand", quantity, "quantity"),
        metric("inventoryValue", value, "money"),
        metric("averageCost", averageCost(quantity, value), "money"),
      ],
      rows,
    }
  }

  private async accountActivity(
    context: RequestContext,
    record: ResourceRecord,
  ) {
    const accountType = String(record.data.accountType ?? "")
    const lines = await this.ledger.accountLedger(
      context.companyId,
      record.id,
      100,
    )
    const running = runningLedgerBalance(accountType, lines)
    const totals = lines.reduce(
      (result, line) => ({
        debit: result.debit + decimalToMinor(line.debit),
        credit: result.credit + decimalToMinor(line.credit),
      }),
      { debit: 0n, credit: 0n },
    )
    const rows: ActivityRow[] = lines
      .map((line, index) => ({
        id: `${line.transactionId}:${index}`,
        date: line.date,
        kind: "journal" as const,
        reference: line.transactionNumber,
        description: line.description || line.memo,
        debit: line.debit,
        credit: line.credit,
        running: running[index],
        ...sourceLink(line.sourceType, line.sourceId),
      }))
      .reverse()
    return {
      kind: "account" as const,
      metrics: [
        metric(
          "balance",
          naturalBalance(
            accountType,
            minorToDecimal(totals.debit),
            minorToDecimal(totals.credit),
          ),
          "money",
        ),
        metric("debitTotal", minorToDecimal(totals.debit), "money"),
        metric("creditTotal", minorToDecimal(totals.credit), "money"),
      ],
      rows,
    }
  }

  private async listRecords(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
  ) {
    const result = await this.resources.list(
      {
        companyId: context.companyId,
        module: moduleName,
        resource: resourceName,
      },
      listAll,
    )
    return result.data
  }
}

/**
 * Documents that still live in the generic store carry lines but no calculated
 * amounts. Each line total and the document total are worked out here, on the
 * server, in minor units — the same money arithmetic the posting engine uses —
 * so no screen ever multiplies or adds up money itself.
 *
 * Journal lines store debit/credit instead of quantity × rate; those sides are
 * used for line and document totals so the list never shows 0.00 for a posted
 * balanced entry.
 */
function withLineTotal(record: ResourceRecord) {
  if (!Array.isArray(record.data.lines)) return record
  const lines = record.data.lines as Array<Record<string, unknown>>
  if (!lines.length) return record
  const isJournal = lines.some(
    (line) => line.debit !== undefined || line.credit !== undefined,
  )
  const priced = lines.map((line) => {
    if (isJournal) {
      const debit = String(line.debit ?? "0")
      const credit = String(line.credit ?? "0")
      const side =
        Number(debit) > 0 ? debit : Number(credit) > 0 ? credit : "0"
      return { ...line, lineTotal: normalizeMoney(side) }
    }
    return line.lineTotal === undefined
      ? { ...line, lineTotal: lineAmount(line) }
      : line
  })
  if (isJournal) {
    const debitTotal = priced.reduce(
      (sum, line) => addMoney(sum, String(line.debit ?? "0")),
      "0.0000",
    )
    return withData(record, { lines: priced, total: debitTotal })
  }
  return withData(record, {
    lines: priced,
    ...(record.data.total === undefined
      ? { total: sumLineAmounts(lines) }
      : {}),
  })
}

function normalizeMoney(value: string) {
  const scaled = decimalToMinor(value)
  return minorToDecimal(scaled)
}

function addMoney(left: string, right: string) {
  return minorToDecimal(decimalToMinor(left) + decimalToMinor(right))
}

const voidedStatuses = new Set(["void", "voided", "cancelled", "canceled"])

/** A document only sits in a receivable once it has reached the ledger. */
function isPosted(status: string) {
  const normalized = status.toLowerCase()
  return normalized !== "draft" && !voidedStatuses.has(normalized)
}

/**
 * What the payments still standing have not been applied to a document yet.
 * Applied money already shows in the document's outstanding amount.
 * Draft payments never touch the subledger, so they are ignored here.
 */
function activeAmounts(payments: ResourceRecord[]) {
  return payments
    .filter((payment) => isPosted(payment.status))
    .map((payment) =>
      unappliedAmount(payment.data.amount ?? "0", payment.data.allocations),
    )
}

/** Amounts of the payments recorded against one customer or vendor. */
function paymentAmounts(
  payments: ResourceRecord[],
  partyField: "customerId" | "vendorId",
  partyId: string,
) {
  return activeAmounts(
    payments.filter(
      (payment) => String(payment.data[partyField] ?? "") === partyId,
    ),
  )
}

/** A bill records its value as `total`; older ones only carry `amount`. */
function billTotal(bill: ResourceRecord) {
  return bill.data.total ?? bill.data.amount ?? "0"
}

function toBillDocument(
  bill: ResourceRecord,
  allocated: Map<string, string>,
): PartyDocument {
  const total = billTotal(bill)
  return {
    outstanding: outstandingAfterAllocations(
      bill.data.balanceDue ?? total,
      total,
      allocated.get(bill.id) ?? "0",
    ),
    total,
    date: String(bill.data.billDate ?? bill.createdAt),
    dueDate: bill.data.dueDate ? String(bill.data.dueDate) : undefined,
    status: bill.status,
  }
}

function toPartyDocument(
  invoice: {
    id: string
    balanceDue: string
    total: string
    invoiceDate: string
    dueDate: string
    status: string
  },
  allocated: Map<string, string>,
): PartyDocument {
  return {
    outstanding: outstandingAfterAllocations(
      invoice.balanceDue,
      invoice.total,
      allocated.get(invoice.id) ?? "0",
    ),
    total: invoice.total,
    date: invoice.invoiceDate,
    dueDate: invoice.dueDate,
    status: invoice.status,
  }
}

/** How much of each document has been settled by a payment allocation. */
function allocationsByDocument(payments: ResourceRecord[]) {
  const totals = new Map<string, string>()
  for (const payment of payments) {
    if (!isPosted(payment.status)) continue
    const allocations = payment.data.allocations
    if (!Array.isArray(allocations)) continue
    for (const allocation of allocations as Array<Record<string, unknown>>) {
      const documentId = String(
        allocation.invoiceId ?? allocation.billId ?? allocation.documentId ?? "",
      )
      if (!documentId) continue
      totals.set(
        documentId,
        addDecimals(totals.get(documentId) ?? "0", allocation.amount ?? "0"),
      )
    }
  }
  return totals
}

/**
 * Carries the party balance forward through the register, oldest first, then
 * returns the rows newest first the way a statement is read. Rows the caller
 * marked as not affecting the balance — unposted invoices, voided documents,
 * cash sales — appear in the history without a running figure, so the last
 * one equals the open balance shown above the register.
 */
function withRunningTotal(rows: ActivityRow[]): ActivityRow[] {
  const ordered = [...rows].sort((left, right) =>
    left.date.localeCompare(right.date),
  )
  let carried = 0n
  const settled = ordered.map((row) => {
    if (row.affectsBalance === false) return row
    carried += decimalToMinor(row.amount ?? "0")
    return { ...row, running: minorToDecimal(carried) }
  })
  return settled.reverse()
}
