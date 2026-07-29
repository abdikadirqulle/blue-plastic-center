import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiClient, type ApiRecord } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-client"
import { formatDecimal } from "@/lib/utils"

export interface ResourceListQuery {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  sort?: "createdAt" | "updatedAt"
  order?: "asc" | "desc"
}

function queryString(query: ResourceListQuery) {
  const parameters = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "" && value !== "All statuses")
      parameters.set(key, String(value))
  }
  return parameters.toString()
}

export function useResourceList(
  module: string,
  resource: string,
  query: ResourceListQuery,
) {
  return useQuery({
    queryKey: queryKeys.resourceList(module, resource, query),
    queryFn: () => apiClient.list(module, resource, queryString(query)),
  })
}

export function useResourceDetail(
  module: string,
  resource: string,
  id: string,
) {
  return useQuery({
    queryKey: queryKeys.resourceDetail(module, resource, id),
    queryFn: () => apiClient.get(module, resource, id),
    enabled: Boolean(id),
  })
}

export function useResourceMutations(module: string, resource: string) {
  const client = useQueryClient()
  const invalidate = () =>
    client.invalidateQueries({ queryKey: queryKeys.resource(module, resource) })
  const create = useMutation({
    mutationFn: ({
      data,
      status,
    }: {
      data: Record<string, unknown>
      status?: string
    }) => apiClient.create(module, resource, data, status),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({
      id,
      data,
      version,
    }: {
      id: string
      data: Record<string, unknown>
      version: number
    }) => apiClient.update(module, resource, id, data, version),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => apiClient.remove(module, resource, id),
    onSuccess: async () => {
      await invalidate()
      await client.invalidateQueries({ queryKey: ["trash"] })
    },
  })
  return { create, update, remove }
}

export function firstValue(record: ApiRecord, keys: string[], fallback = "—") {
  for (const key of keys) {
    const value = record.data[key]
    if (value !== undefined && value !== null && value !== "")
      return String(value)
  }
  return fallback
}

export function recordTitle(record: ApiRecord) {
  return firstValue(
    record,
    [
      "displayName",
      "name",
      "accountName",
      "projectName",
      "documentNumber",
      "description",
      "firstName",
    ],
    "Untitled record",
  )
}

export function recordIdentifier(record: ApiRecord) {
  return firstValue(
    record,
    [
      "documentNumber",
      "accountNumber",
      "sku",
      "code",
      "employeeId",
      "checkNumber",
      "reference",
      "displayName",
      "name",
      "accountName",
      "projectName",
    ],
    recordTitle(record),
  )
}

export function recordAmount(record: ApiRecord) {
  const value = firstValue(
    record,
    [
      "amount",
      "originalAmount",
      "outstanding",
      "contractAmount",
      "cost",
      "grossPay",
    ],
    "0",
  )
  return /^-?\d+(\.\d+)?$/.test(value)
    ? `$${formatDecimal(value)}`
    : value
}

export function recordDate(record: ApiRecord) {
  const key = Object.keys(record.data).find((name) =>
    /date$|Date$|periodEnd|dueDate/.test(name),
  )
  return key
    ? String(record.data[key] ?? record.createdAt.slice(0, 10))
    : record.createdAt.slice(0, 10)
}
