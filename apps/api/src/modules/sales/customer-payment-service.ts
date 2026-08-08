import {
  allocationSchema,
  customerPaymentCreateDataSchema,
  customerPaymentUpdateDataSchema,
} from "@blue-plastic/types"
import { conflict, notFound, validation } from "../../platform/errors.js"
import type { ListQuery, RequestContext } from "../../platform/types.js"
import type {
  CustomerPaymentCreateOptions,
  CustomerPaymentRepository,
} from "./customer-payment-repository.js"

export class CustomerPaymentService {
  constructor(private readonly payments: CustomerPaymentRepository) {}

  list(context: RequestContext, query: ListQuery) {
    return this.payments.list(context, query)
  }

  async get(context: RequestContext, id: string) {
    const payment = await this.payments.findById(context, id)
    if (!payment) throw notFound("Customer payment was not found")
    return payment
  }

  create(
    context: RequestContext,
    input: { status?: string; data: unknown },
    options?: CustomerPaymentCreateOptions,
  ) {
    if (input.status && input.status.toLowerCase() !== "draft")
      throw conflict("Customer payments must be created as drafts")
    const parsed = customerPaymentCreateDataSchema.safeParse(input.data)
    if (!parsed.success)
      throw validation("Customer payment validation failed", parsed.error.flatten())
    return this.payments.create(context, parsed.data, options)
  }

  update(
    context: RequestContext,
    id: string,
    input: { status?: string; version?: number; data: unknown },
  ) {
    if (input.status && input.status.toLowerCase() !== "draft")
      throw conflict("Payment posting and reversal require secured workflow endpoints")
    const parsed = customerPaymentUpdateDataSchema.safeParse(input.data)
    if (!parsed.success)
      throw validation("Customer payment validation failed", parsed.error.flatten())
    return this.payments.update(context, id, parsed.data, input.version)
  }

  allocate(context: RequestContext, id: string, input: unknown) {
    const parsed = allocationSchema.safeParse(input)
    if (!parsed.success)
      throw validation("Payment allocation validation failed", parsed.error.flatten())
    return this.payments.replaceAllocations(context, id, parsed.data.allocations)
  }

  post(context: RequestContext, id: string, idempotencyKey: string) {
    if (!idempotencyKey.trim())
      throw validation("Idempotency-Key header is required when posting a customer payment")
    return this.payments.post(context, id, idempotencyKey)
  }

  remove(context: RequestContext, id: string) {
    return this.payments.remove(context, id)
  }
}
