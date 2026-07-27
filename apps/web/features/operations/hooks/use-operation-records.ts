import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-client"
import type {
  OperationsModule,
  OperationsQuery,
  OperationsResource,
} from "../domain/operation-record"
import { operationsService } from "../services/operations-service"

export function useOperationRecords(
  module: OperationsModule,
  resource: OperationsResource,
  query: OperationsQuery,
) {
  const client = useQueryClient()
  const result = useQuery({
    queryKey: queryKeys.resourceList(module, resource, query),
    queryFn: () => operationsService.list(module, resource, query),
  })
  const invalidate = () =>
    client.invalidateQueries({ queryKey: queryKeys.resource(module, resource) })
  const remove = useMutation({
    mutationFn: (id: string) => operationsService.remove(module, resource, id),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      operationsService.update(module, resource, id, { status }),
    onSuccess: invalidate,
  })
  return {
    records: result.data ?? [],
    loading: result.isLoading,
    error: result.error instanceof Error ? result.error.message : null,
    reload: result.refetch,
    remove: remove.mutateAsync,
    updateStatus: (id: string, status: string) =>
      update.mutateAsync({ id, status }),
  }
}
