import { apiClient, type ApiRecord } from "@/lib/api-client"
import {
  firstValue,
  recordAmount,
  recordDate,
  recordTitle,
} from "../../resources/resource-api"
import type {
  OperationRecord,
  OperationRecordInput,
  OperationsModule,
  OperationsQuery,
  OperationsRepository,
  OperationsResource,
} from "../domain/operation-record"

function toDomain(
  module: OperationsModule,
  resource: OperationsResource,
  record: ApiRecord,
): OperationRecord {
  return {
    id: record.id,
    module,
    resource,
    name: recordTitle(record),
    secondary: firstValue(record, ["description", "vendorId", "warehouseId", "type"]),
    amount: recordAmount(record),
    date: recordDate(record),
    status: record.status,
    reference: firstValue(record, ["documentNumber", "reference"], ""),
    version: record.version,
    data: record.data,
    meta: Object.fromEntries(
      Object.entries(record.data)
        .filter(([, value]) => ["string", "number", "boolean"].includes(typeof value))
        .map(([key, value]) => [key, String(value)]),
    ),
  }
}

export class ApiOperationsRepository implements OperationsRepository {
  async list(
    module: OperationsModule,
    resource: OperationsResource,
    query: OperationsQuery = {},
  ) {
    const params = new URLSearchParams()
    if (query.search) params.set("search", query.search)
    if (query.status && query.status !== "All statuses")
      params.set("status", query.status)
    const response = await apiClient.list(module, resource, params.toString())
    return response.data.map((record) => toDomain(module, resource, record))
  }

  async get(module: OperationsModule, resource: OperationsResource, id: string) {
    return toDomain(module, resource, (await apiClient.get(module, resource, id)).data)
  }

  async create(
    module: OperationsModule,
    resource: OperationsResource,
    input: OperationRecordInput,
  ) {
    return toDomain(
      module,
      resource,
      (await apiClient.create(module, resource, input, input.status)).data,
    )
  }

  async update(
    module: OperationsModule,
    resource: OperationsResource,
    id: string,
    input: Partial<OperationRecordInput>,
  ) {
    const current = (await apiClient.get(module, resource, id)).data
    return toDomain(
      module,
      resource,
      (await apiClient.update(
        module,
        resource,
        id,
        input,
        current.version,
        input.status,
      )).data,
    )
  }

  async remove(module: OperationsModule, resource: OperationsResource, id: string) {
    await apiClient.remove(module, resource, id)
  }
}
