import { apiClient, type ApiRecord } from "@/lib/api-client"
import {
  firstValue,
  recordAmount,
  recordDate,
  recordTitle,
} from "../../resources/resource-api"
import type {
  SalesQuery,
  SalesRecord,
  SalesRecordInput,
  SalesRepository,
  SalesResource,
} from "../domain/sales-record"

function toDomain(resource: SalesResource, record: ApiRecord): SalesRecord {
  return {
    id: record.id,
    resource,
    customer: recordTitle(record),
    amount: recordAmount(record),
    date: recordDate(record),
    status: record.status,
    reference: firstValue(record, ["documentNumber", "reference", "poNumber"], ""),
    paymentMethod: firstValue(record, ["paymentMethod"], ""),
    memo: firstValue(record, ["memo", "message"], ""),
    version: record.version,
    data: record.data,
  }
}

export class ApiSalesRepository implements SalesRepository {
  async list(resource: SalesResource, query: SalesQuery = {}) {
    const params = new URLSearchParams()
    if (query.search) params.set("search", query.search)
    if (query.status && query.status !== "All statuses")
      params.set("status", query.status)
    const response = await apiClient.list("sales", resource, params.toString())
    return response.data.map((record) => toDomain(resource, record))
  }

  async get(resource: SalesResource, id: string) {
    return toDomain(resource, (await apiClient.get("sales", resource, id)).data)
  }

  async create(resource: SalesResource, input: SalesRecordInput) {
    return toDomain(
      resource,
      (await apiClient.create("sales", resource, input, input.status)).data,
    )
  }

  async update(
    resource: SalesResource,
    id: string,
    input: Partial<SalesRecordInput>,
  ) {
    const current = (await apiClient.get("sales", resource, id)).data
    return toDomain(
      resource,
      (await apiClient.update(
        "sales",
        resource,
        id,
        input,
        current.version,
        input.status,
      )).data,
    )
  }

  async remove(resource: SalesResource, id: string) {
    await apiClient.remove("sales", resource, id)
  }
}
