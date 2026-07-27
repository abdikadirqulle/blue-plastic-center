import { ApiEnterpriseRepository } from "../data/api-enterprise-repository";
import { MockEnterpriseRepository } from "../data/mock-enterprise-repository";
import type { EnterpriseModule, EnterpriseQuery, EnterpriseRepository } from "../domain/enterprise-record";

const repository: EnterpriseRepository = process.env.NEXT_PUBLIC_DATA_SOURCE === "api"
  ? new ApiEnterpriseRepository()
  : new MockEnterpriseRepository();

export const enterpriseService = {
  list: (module: EnterpriseModule, resource: string, query?: EnterpriseQuery) => repository.list(module, resource, query),
  get: (module: EnterpriseModule, resource: string, id: string) => repository.get(module, resource, id),
  update: (module: EnterpriseModule, resource: string, id: string, values: Parameters<EnterpriseRepository["update"]>[3]) => repository.update(module, resource, id, values),
  remove: (module: EnterpriseModule, resource: string, id: string) => repository.remove(module, resource, id),
};
