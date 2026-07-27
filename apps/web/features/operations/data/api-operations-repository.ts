import { webEnv } from "@/lib/env";
import { apiFetch } from "@/lib/api-fetch";
import type {
  OperationRecord,
  OperationRecordInput,
  OperationsModule,
  OperationsQuery,
  OperationsRepository,
  OperationsResource,
} from "../domain/operation-record";

export class ApiOperationsRepository implements OperationsRepository {
  constructor(private readonly baseUrl = `${webEnv.apiUrl}/v1`) {}

  private url(module: OperationsModule, resource: OperationsResource, id?: string) {
    return `${this.baseUrl}/${module}/${resource}${id ? `/${encodeURIComponent(id)}` : ""}`;
  }

  async list(module: OperationsModule, resource: OperationsResource, query: OperationsQuery = {}) {
    const params = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])));
    const response = await apiFetch(`${this.url(module, resource)}?${params}`);
    if (!response.ok) throw new Error(`Unable to load ${resource}`);
    return response.json() as Promise<OperationRecord[]>;
  }

  async get(module: OperationsModule, resource: OperationsResource, id: string) {
    const response = await apiFetch(this.url(module, resource, id));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Unable to load ${id}`);
    return response.json() as Promise<OperationRecord>;
  }

  async create(module: OperationsModule, resource: OperationsResource, input: OperationRecordInput) {
    const response = await apiFetch(this.url(module, resource), { method: "POST", body: JSON.stringify(input) });
    if (!response.ok) throw new Error(`Unable to create ${resource}`);
    return response.json() as Promise<OperationRecord>;
  }

  async update(module: OperationsModule, resource: OperationsResource, id: string, input: Partial<OperationRecordInput>) {
    const response = await apiFetch(this.url(module, resource, id), { method: "PATCH", body: JSON.stringify(input) });
    if (!response.ok) throw new Error(`Unable to update ${id}`);
    return response.json() as Promise<OperationRecord>;
  }

  async remove(module: OperationsModule, resource: OperationsResource, id: string) {
    const response = await apiFetch(this.url(module, resource, id), { method: "DELETE" });
    if (!response.ok) throw new Error(`Unable to delete ${id}`);
  }
}
