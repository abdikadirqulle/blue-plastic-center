import type {
  OperationRecord,
  OperationRecordInput,
  OperationsModule,
  OperationsQuery,
  OperationsRepository,
  OperationsResource,
} from "../domain/operation-record";
import { createMockOperationRecords } from "./mock-operation-records";

const keyOf = (module: OperationsModule, resource: OperationsResource) => `${module}/${resource}`;

export class MockOperationsRepository implements OperationsRepository {
  private records = new Map<string, OperationRecord[]>();

  private collection(module: OperationsModule, resource: OperationsResource) {
    const key = keyOf(module, resource);
    if (!this.records.has(key)) this.records.set(key, createMockOperationRecords(module, resource));
    return this.records.get(key) ?? [];
  }

  async list(module: OperationsModule, resource: OperationsResource, query: OperationsQuery = {}) {
    const search = query.search?.toLowerCase();
    return this.collection(module, resource).filter((record) => {
      const matchesSearch = !search || [record.id, record.name, record.secondary, record.reference]
        .some((value) => value.toLowerCase().includes(search));
      const matchesStatus = !query.status || query.status === "All statuses" || record.status === query.status;
      return matchesSearch && matchesStatus
        && (!query.from || record.date >= query.from)
        && (!query.to || record.date <= query.to);
    }).map((record) => ({ ...record, meta: { ...record.meta } }));
  }

  async get(module: OperationsModule, resource: OperationsResource, id: string) {
    return this.collection(module, resource).find((record) => record.id === id) ?? null;
  }

  async create(module: OperationsModule, resource: OperationsResource, input: OperationRecordInput) {
    const record: OperationRecord = {
      id: `${resource.replaceAll("-", "").slice(0, 3).toUpperCase()}-${Date.now().toString().slice(-6)}`,
      module,
      resource,
      name: input.name,
      secondary: input.secondary ?? "",
      amount: input.amount ?? "$0.00",
      date: input.date ?? new Date().toISOString().slice(0, 10),
      status: input.status ?? "Draft",
      reference: input.reference ?? "",
      meta: input.meta ?? {},
    };
    this.records.set(keyOf(module, resource), [record, ...this.collection(module, resource)]);
    return { ...record };
  }

  async update(module: OperationsModule, resource: OperationsResource, id: string, input: Partial<OperationRecordInput>) {
    const current = await this.get(module, resource, id);
    if (!current) throw new Error(`${id} was not found`);
    const updated = { ...current, ...input, meta: { ...current.meta, ...input.meta } };
    this.records.set(keyOf(module, resource), this.collection(module, resource).map((record) => record.id === id ? updated : record));
    return { ...updated };
  }

  async remove(module: OperationsModule, resource: OperationsResource, id: string) {
    this.records.set(keyOf(module, resource), this.collection(module, resource).filter((record) => record.id !== id));
  }
}
