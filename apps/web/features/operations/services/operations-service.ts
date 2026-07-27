import type {
  OperationRecordInput,
  OperationsModule,
  OperationsQuery,
  OperationsRepository,
  OperationsResource,
} from "../domain/operation-record";
import { ApiOperationsRepository } from "../data/api-operations-repository";
import { MockOperationsRepository } from "../data/mock-operations-repository";

const repository: OperationsRepository = process.env.NEXT_PUBLIC_DATA_SOURCE === "api"
  ? new ApiOperationsRepository()
  : new MockOperationsRepository();

export const operationsService = {
  list: (module: OperationsModule, resource: OperationsResource, query?: OperationsQuery) =>
    repository.list(module, resource, query),
  get: (module: OperationsModule, resource: OperationsResource, id: string) =>
    repository.get(module, resource, id),
  create: (module: OperationsModule, resource: OperationsResource, input: OperationRecordInput) =>
    repository.create(module, resource, input),
  update: (module: OperationsModule, resource: OperationsResource, id: string, input: Partial<OperationRecordInput>) =>
    repository.update(module, resource, id, input),
  remove: (module: OperationsModule, resource: OperationsResource, id: string) =>
    repository.remove(module, resource, id),
};
