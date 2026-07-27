export type EnterpriseModule = "accounting" | "projects" | "payroll";

export interface EnterpriseRecord {
  id: string;
  module: EnterpriseModule;
  resource: string;
  name: string;
  detail: string;
  value: string;
  date: string;
  status: string;
  metrics: Record<string, string>;
}

export interface EnterpriseQuery {
  search?: string;
  status?: string;
}

export interface EnterpriseRepository {
  list(module: EnterpriseModule, resource: string, query?: EnterpriseQuery): Promise<EnterpriseRecord[]>;
  get(module: EnterpriseModule, resource: string, id: string): Promise<EnterpriseRecord | null>;
  update(module: EnterpriseModule, resource: string, id: string, values: Partial<EnterpriseRecord>): Promise<EnterpriseRecord>;
  remove(module: EnterpriseModule, resource: string, id: string): Promise<void>;
}
