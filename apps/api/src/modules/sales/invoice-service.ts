import {
  invoiceCreateDataSchema,
  invoiceUpdateDataSchema,
  invoiceVoidSchema,
} from "@blue-plastic/types"
import { conflict, notFound, validation } from "../../platform/errors.js"
import type { ListQuery, RequestContext } from "../../platform/types.js"
import type {
  InvoiceCreateOptions,
  InvoiceRepository,
  InvoiceWrite,
} from "./invoice-repository.js"

export class InvoiceService {
  constructor(private readonly invoices: InvoiceRepository) {}

  list(context: RequestContext, query: ListQuery) {
    return this.invoices.list(context, query)
  }

  async get(context: RequestContext, id: string) {
    const invoice = await this.invoices.findById(context, id)
    if (!invoice) throw notFound("Invoice was not found")
    return invoice
  }

  create(
    context: RequestContext,
    input: { status?: string; data: unknown },
    options?: InvoiceCreateOptions,
  ) {
    if (input.status && input.status.toLowerCase() !== "draft")
      throw conflict("Invoices must be created as drafts and posted through the post endpoint")
    const parsed = invoiceCreateDataSchema.safeParse(input.data)
    if (!parsed.success)
      throw validation("Invoice validation failed", parsed.error.flatten())
    return this.invoices.create(
      context,
      { status: "draft", data: parsed.data },
      options,
    )
  }

  async update(
    context: RequestContext,
    id: string,
    input: { status?: string; version?: number; data: unknown },
  ) {
    if (input.status && input.status.toLowerCase() !== "draft")
      throw conflict("Invoice status transitions must use a secured workflow endpoint")
    const parsed = invoiceUpdateDataSchema.safeParse(input.data)
    if (!parsed.success)
      throw validation("Invoice validation failed", parsed.error.flatten())
    return this.invoices.update(context, id, {
      status: input.status,
      version: input.version,
      data: parsed.data,
    } satisfies InvoiceWrite)
  }

  post(context: RequestContext, id: string, idempotencyKey: string) {
    if (!idempotencyKey.trim())
      throw validation("Idempotency-Key header is required when posting an invoice")
    return this.invoices.post(context, id, idempotencyKey)
  }

  void(
    context: RequestContext,
    id: string,
    input: unknown,
    idempotencyKey: string,
  ) {
    if (!idempotencyKey.trim())
      throw validation("Idempotency-Key header is required when voiding an invoice")
    const parsed = invoiceVoidSchema.safeParse(input ?? {})
    if (!parsed.success)
      throw validation("Invoice void validation failed", parsed.error.flatten())
    return this.invoices.void(context, id, parsed.data, idempotencyKey)
  }

  remove(context: RequestContext, id: string) {
    return this.invoices.remove(context, id)
  }
}
