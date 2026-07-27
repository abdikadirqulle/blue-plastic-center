import type { SalesQuery, SalesRecord, SalesRecordInput, SalesRepository, SalesResource } from "../domain/sales-record";
import { webEnv } from "@/lib/env";
import { apiFetch } from "@/lib/api-fetch";

interface ApiResourceRecord {
  id: string;
  status: string;
  version: number;
  createdAt: string;
  data: SalesRecordInput;
}

export class ApiSalesRepository implements SalesRepository {
  constructor(
    private readonly baseUrl = `${webEnv.apiUrl}/v1`,
  ) {}

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await apiFetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...init?.headers,
      },
    });
    if (!response.ok) throw new Error(`Sales API request failed (${response.status})`);
    if (response.status === 204) return undefined as T;
    const result = await response.json() as { data: T };
    return result.data;
  }

  private toDomain(resource: SalesResource, record: ApiResourceRecord): SalesRecord {
    return {
      id: record.id,
      resource,
      customer: record.data.customer,
      amount: record.data.amount,
      date: record.data.date,
      status: record.status,
      reference: record.data.reference,
      paymentMethod: record.data.paymentMethod,
      memo: record.data.memo,
      version: record.version,
    };
  }

  async list(resource: SalesResource, query: SalesQuery = {}) {
    const params = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])));
    const records = await this.request<ApiResourceRecord[]>(`/sales/${resource}?${params}`);
    return records.map((record) => this.toDomain(resource, record));
  }

  async get(resource: SalesResource, id: string) {
    const record = await this.request<ApiResourceRecord>(`/sales/${resource}/${encodeURIComponent(id)}`);
    return this.toDomain(resource, record);
  }

  async create(resource: SalesResource, input: SalesRecordInput) {
    const record = await this.request<ApiResourceRecord>(`/sales/${resource}`, {
      method: "POST",
      body: JSON.stringify({ data: input, status: input.status ?? "draft" }),
    });
    return this.toDomain(resource, record);
  }

  async update(resource: SalesResource, id: string, input: Partial<SalesRecordInput>) {
    const current = await this.get(resource, id);
    const record = await this.request<ApiResourceRecord>(`/sales/${resource}/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ data: input, version: current?.version ?? 1 }),
    });
    return this.toDomain(resource, record);
  }

  async remove(resource: SalesResource, id: string) {
    await this.request(`/sales/${resource}/${encodeURIComponent(id)}`, { method: "DELETE" });
  }
}
