import type { SalesQuery, SalesRecordInput, SalesRepository, SalesResource } from "../domain/sales-record";
import { ApiSalesRepository } from "../data/api-sales-repository";
import { MockSalesRepository } from "../data/mock-sales-repository";

const repository: SalesRepository =
  process.env.NEXT_PUBLIC_DATA_SOURCE === "api"
    ? new ApiSalesRepository()
    : new MockSalesRepository();

export const salesService = {
  list: (resource: SalesResource, query?: SalesQuery) => repository.list(resource, query),
  get: (resource: SalesResource, id: string) => repository.get(resource, id),
  create: (resource: SalesResource, input: SalesRecordInput) => repository.create(resource, input),
  update: (resource: SalesResource, id: string, input: Partial<SalesRecordInput>) => repository.update(resource, id, input),
  remove: (resource: SalesResource, id: string) => repository.remove(resource, id),
  convert: async (from: SalesResource, id: string, to: SalesResource) => {
    const source = await repository.get(from, id);
    if (!source) throw new Error(`${id} was not found`);
    return repository.create(to, {
      customer: source.customer,
      amount: source.amount,
      date: new Date().toISOString().slice(0, 10),
      reference: source.id,
      memo: `Converted from ${source.id}`,
    });
  },
};
