import type { SalesQuery, SalesRecordInput, SalesRepository, SalesResource } from "../domain/sales-record";
import { ApiSalesRepository } from "../data/api-sales-repository";
import { apiClient } from "@/lib/api-client";

const repository: SalesRepository = new ApiSalesRepository();

export const salesService = {
  list: (resource: SalesResource, query?: SalesQuery) => repository.list(resource, query),
  get: (resource: SalesResource, id: string) => repository.get(resource, id),
  create: (resource: SalesResource, input: SalesRecordInput) => repository.create(resource, input),
  update: (resource: SalesResource, id: string, input: Partial<SalesRecordInput>) => repository.update(resource, id, input),
  remove: (resource: SalesResource, id: string) => repository.remove(resource, id),
  convert: async (from: SalesResource, id: string, to: SalesResource) => {
    const response = await apiClient.action<{ id: string }>(
      `/v1/sales/${from}/${encodeURIComponent(id)}/convert`,
      { targetResource: to },
    )
    return response.data
  },
};
