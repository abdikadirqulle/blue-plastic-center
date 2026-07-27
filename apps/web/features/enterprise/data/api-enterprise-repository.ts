import { apiClient, type ApiRecord } from "@/lib/api-client"
import {
  firstValue,
  recordAmount,
  recordDate,
  recordTitle,
} from "../../resources/resource-api"
import type {
  EnterpriseModule,
  EnterpriseQuery,
  EnterpriseRecord,
  EnterpriseRepository,
} from "../domain/enterprise-record"

function toDomain(record: ApiRecord): EnterpriseRecord {
  return {
    id: record.id,
    module: record.module as EnterpriseModule,
    resource: record.resource,
    name: recordTitle(record),
    detail: firstValue(record, ["memo", "description", "accountType", "customerId"]),
    value: recordAmount(record),
    date: recordDate(record),
    status: record.status,
    version: record.version,
    data: record.data,
    metrics: {
      progress: firstValue(record, ["progress"], "0%"),
      variance: firstValue(record, ["variance"], "$0"),
    },
  }
}

export class ApiEnterpriseRepository implements EnterpriseRepository {
  async list(
    module: EnterpriseModule,
    resource: string,
    query: EnterpriseQuery = {},
  ) {
    const params = new URLSearchParams()
    if (query.search) params.set("search", query.search)
    if (query.status && query.status !== "All statuses")
      params.set("status", query.status)
    const response = await apiClient.list(module, resource, params.toString())
    return response.data.map(toDomain)
  }

  async get(module: EnterpriseModule, resource: string, id: string) {
    return toDomain((await apiClient.get(module, resource, id)).data)
  }

  async update(
    module: EnterpriseModule,
    resource: string,
    id: string,
    values: Partial<EnterpriseRecord>,
  ) {
    const current = (await apiClient.get(module, resource, id)).data
    const response = await apiClient.update(
      module,
      resource,
      id,
      values.data ?? {},
      current.version,
      values.status,
    )
    return toDomain(response.data)
  }

  async remove(module: EnterpriseModule, resource: string, id: string) {
    await apiClient.remove(module, resource, id)
  }
}
