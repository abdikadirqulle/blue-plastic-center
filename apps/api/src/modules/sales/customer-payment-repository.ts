import type {
  CustomerPaymentCreateData,
  CustomerPaymentUpdateData,
} from "@blue-plastic/types"
import type { ListQuery, RequestContext, ResourceRecord } from "../../platform/types.js"

export interface PaymentAllocationInput {
  invoiceId: string
  amount: string
}

export interface CustomerPaymentCreateOptions {
  idempotencyKey?: string
  requestHash?: string
}

export interface CustomerPaymentRepository {
  list(
    context: RequestContext,
    query: ListQuery,
  ): Promise<{ data: ResourceRecord[]; total: number }>
  findById(context: RequestContext, id: string): Promise<ResourceRecord | undefined>
  create(
    context: RequestContext,
    data: CustomerPaymentCreateData,
    options?: CustomerPaymentCreateOptions,
  ): Promise<ResourceRecord>
  update(
    context: RequestContext,
    id: string,
    data: CustomerPaymentUpdateData,
    version?: number,
  ): Promise<ResourceRecord>
  replaceAllocations(
    context: RequestContext,
    id: string,
    allocations: PaymentAllocationInput[],
  ): Promise<ResourceRecord>
  remove(context: RequestContext, id: string): Promise<void>
}
