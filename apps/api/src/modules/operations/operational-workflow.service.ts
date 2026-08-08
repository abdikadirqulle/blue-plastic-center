import { conflict, validation } from "../../platform/errors.js"
import type { RequestContext } from "../../platform/types.js"
import type { ResourceService } from "../../services/resource-service.js"
import { sumLineAmounts } from "./money.js"
import type { PostingLine } from "../accounting/posting-engine.js"

const transitions: Record<string, Record<string, string[]>> = {
  fulfillment: {
    draft: ["allocated"],
    allocated: ["picked"],
    picked: ["packed"],
    packed: ["shipped"],
  },
  "bank-feeds": {
    pending: ["matched", "added", "excluded"],
    draft: ["matched", "added", "excluded"],
  },
  approvals: {
    pending: ["approved", "rejected", "changes-requested"],
  },
  reconciliation: {
    draft: ["reconciled"],
    "in-progress": ["reconciled"],
  },
}

export class OperationalWorkflowService {
  constructor(private readonly resources: ResourceService) {}

  async transition(
    context: RequestContext,
    moduleName: string,
    resourceName: string,
    id: string,
    status: string,
    data: Record<string, unknown> = {},
  ) {
    const current = await this.resources.get(context, moduleName, resourceName, id)
    const allowed = transitions[resourceName]?.[current.status] ?? []
    if (!allowed.includes(status)) {
      throw conflict(`Cannot move ${resourceName} from ${current.status} to ${status}`)
    }
    return this.resources.update(context, moduleName, resourceName, id, {
      version: current.version,
      status,
      data: { ...data, workflowUpdatedAt: new Date().toISOString() },
    }, { allowWorkflowTransition: true })
  }

  async convertSalesDocument(
    context: RequestContext,
    sourceResource: string,
    id: string,
    targetResource: "sales-orders" | "invoices",
  ) {
    const source = await this.resources.get(context, "sales", sourceResource, id)
    const permitted = sourceResource === "estimates"
      ? ["sales-orders", "invoices"]
      : sourceResource === "sales-orders"
        ? ["invoices"]
        : []
    if (!permitted.includes(targetResource)) throw validation("Unsupported sales document conversion")
    if (source.status === "void") throw conflict("Voided documents cannot be converted")

    const sourceDate = new Date().toISOString().slice(0, 10)
    const data = {
      ...source.data,
      ...(targetResource === "sales-orders"
        ? { orderDate: sourceDate }
        : { invoiceDate: sourceDate, dueDate: sourceDate }),
      sourceDocumentId: source.id,
      sourceDocumentType: sourceResource,
    }
    return this.resources.create(context, "sales", targetResource, { status: "draft", data })
  }

  async receivePurchaseOrder(
    context: RequestContext,
    id: string,
    input: Record<string, unknown>,
  ) {
    const order = await this.resources.get(context, "purchasing", "purchase-orders", id)
    if (["closed", "cancelled"].includes(order.status)) throw conflict("Purchase order cannot be received")
    const receiptInput = input as {
      receiptDate: string
      warehouseId: string
      lines: Array<{ lineNumber: number; quantityReceived: string }>
    }
    const orderLines = Array.isArray(order.data.lines)
      ? order.data.lines as Array<Record<string, unknown>>
      : []
    const lines = receiptInput.lines.map((received) => ({
      ...(orderLines[received.lineNumber - 1] ?? {}),
      quantity: received.quantityReceived,
      warehouseId: receiptInput.warehouseId,
    }))
    return this.resources.create(context, "purchasing", "receipts", {
      status: "received",
      data: {
        vendorId: order.data.vendorId,
        purchaseOrderId: order.id,
        receiptDate: receiptInput.receiptDate,
        warehouseId: receiptInput.warehouseId,
        lines,
      },
    }, undefined, { allowWorkflowStatus: true })
  }

  async createDraftPosting(
    context: RequestContext,
    sourceModule: string,
    sourceResource: string,
    sourceId: string,
    transactionDate: string,
    lines: Array<Record<string, unknown>>,
    debitAccount: Pick<PostingLine, "accountId" | "systemAccountKey">,
    creditAccount: Pick<PostingLine, "accountId" | "systemAccountKey">,
  ) {
    const amount = sumLineAmounts(lines)
    return this.resources.create(context, "accounting", "journal-entries", {
      status: "draft",
      data: {
        journalDate: transactionDate,
        sourceModule,
        sourceResource,
        sourceId,
        lines: [
          { ...debitAccount, debit: amount, credit: "0.0000" },
          { ...creditAccount, debit: "0.0000", credit: amount },
        ],
      },
    })
  }
}
