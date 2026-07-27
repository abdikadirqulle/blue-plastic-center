import type { SalesQuery, SalesRecord, SalesRecordInput, SalesRepository, SalesResource } from "../domain/sales-record";
import { mockSalesRecords } from "./mock-sales-records";

const clone = (records: SalesRecord[]) => records.map((record) => ({ ...record }));

export class MockSalesRepository implements SalesRepository {
  private records: Record<SalesResource, SalesRecord[]> = Object.fromEntries(
    Object.entries(mockSalesRecords).map(([resource, records]) => [resource, clone(records)]),
  ) as Record<SalesResource, SalesRecord[]>;

  async list(resource: SalesResource, query: SalesQuery = {}) {
    const search = query.search?.toLowerCase();
    return clone(this.records[resource]).filter((record) => {
      const matchesSearch = !search || [record.id, record.customer, record.reference, record.memo]
        .some((value) => value?.toLowerCase().includes(search));
      const matchesStatus = !query.status || query.status === "All statuses" || record.status === query.status;
      const matchesFrom = !query.from || record.date >= query.from;
      const matchesTo = !query.to || record.date <= query.to;
      return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    });
  }

  async get(resource: SalesResource, id: string) {
    return this.records[resource].find((record) => record.id === id) ?? null;
  }

  async create(resource: SalesResource, input: SalesRecordInput) {
    const record: SalesRecord = {
      ...input,
      id: `${resource.slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      resource,
      status: input.status ?? "Draft",
    };
    this.records[resource] = [record, ...this.records[resource]];
    return { ...record };
  }

  async update(resource: SalesResource, id: string, input: Partial<SalesRecordInput>) {
    const current = await this.get(resource, id);
    if (!current) throw new Error(`${id} was not found`);
    const updated = { ...current, ...input };
    this.records[resource] = this.records[resource].map((record) => record.id === id ? updated : record);
    return { ...updated };
  }

  async remove(resource: SalesResource, id: string) {
    this.records[resource] = this.records[resource].filter((record) => record.id !== id);
  }
}
