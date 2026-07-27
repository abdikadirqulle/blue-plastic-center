import type { EnterpriseModule, EnterpriseQuery, EnterpriseRecord, EnterpriseRepository } from "../domain/enterprise-record";

export class ApiEnterpriseRepository implements EnterpriseRepository {
  constructor(private readonly baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "/api") {}
  private url(module: EnterpriseModule, resource: string, id?: string) {
    return `${this.baseUrl}/${module}/${resource}${id ? `/${encodeURIComponent(id)}` : ""}`;
  }
  async list(module: EnterpriseModule, resource: string, query: EnterpriseQuery = {}) {
    const params = new URLSearchParams(Object.entries(query).filter((entry): entry is [string, string] => Boolean(entry[1])));
    const response = await fetch(`${this.url(module, resource)}?${params}`);
    if (!response.ok) throw new Error(`Unable to load ${resource}`);
    return response.json() as Promise<EnterpriseRecord[]>;
  }
  async get(module: EnterpriseModule, resource: string, id: string) {
    const response = await fetch(this.url(module, resource, id));
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Unable to load ${id}`);
    return response.json() as Promise<EnterpriseRecord>;
  }
  async update(module: EnterpriseModule, resource: string, id: string, values: Partial<EnterpriseRecord>) {
    const response = await fetch(this.url(module, resource, id), { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(values) });
    if (!response.ok) throw new Error(`Unable to update ${id}`);
    return response.json() as Promise<EnterpriseRecord>;
  }
  async remove(module: EnterpriseModule, resource: string, id: string) {
    const response = await fetch(this.url(module, resource, id), { method: "DELETE" });
    if (!response.ok) throw new Error(`Unable to delete ${id}`);
  }
}
