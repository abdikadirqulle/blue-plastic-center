import type {
  InvoiceCreateData,
  InvoiceUpdateData,
  InvoiceVoidInput,
} from "@blue-plastic/types"
import type { ListQuery, RequestContext, ResourceRecord } from "../../platform/types.js"

export interface InvoiceWrite {
  status?: string
  version?: number
  data: InvoiceCreateData | InvoiceUpdateData
}

export interface InvoiceCreateOptions {
  idempotencyKey?: string
  requestHash?: string
}

/** Flat invoice projection used by customer balances and the customer register. */
export interface InvoiceDocumentView {
  id: string
  customerId: string
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  /** When the invoice was posted or created — used for register date/time display. */
  recordedAt: string
  status: string
  total: string
  amountPaid: string
  balanceDue: string
}

export interface InvoiceRepository {
  /**
   * Every live invoice for the given customers, newest first. Balances are
   * derived from these rows rather than stored on the customer, so a customer
   * can never carry a figure the invoice tables disagree with.
   */
  listByCustomers(
    context: RequestContext,
    customerIds: string[],
  ): Promise<InvoiceDocumentView[]>
  list(
    context: RequestContext,
    query: ListQuery,
  ): Promise<{ data: ResourceRecord[]; total: number }>
  findById(context: RequestContext, id: string): Promise<ResourceRecord | undefined>
  create(
    context: RequestContext,
    input: InvoiceWrite,
    options?: InvoiceCreateOptions,
  ): Promise<ResourceRecord>
  update(
    context: RequestContext,
    id: string,
    input: InvoiceWrite,
  ): Promise<ResourceRecord>
  post(
    context: RequestContext,
    id: string,
    idempotencyKey: string,
  ): Promise<ResourceRecord>
  /** Reverses a posted invoice. The original invoice and journal are preserved. */
  void(
    context: RequestContext,
    id: string,
    input: InvoiceVoidInput,
    idempotencyKey: string,
  ): Promise<ResourceRecord>
  /** Soft-deletes a draft invoice. Posted invoices must be voided instead. */
  remove(context: RequestContext, id: string): Promise<void>
}
