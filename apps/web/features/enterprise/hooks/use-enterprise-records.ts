import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-client"
import type { EnterpriseModule } from "../domain/enterprise-record"
import { enterpriseService } from "../services/enterprise-service"

export function useEnterpriseRecords(
  module: EnterpriseModule,
  resource: string,
  search: string,
  status: string,
) {
  const client = useQueryClient()
  const query = { search, status }
  const result = useQuery({
    queryKey: queryKeys.resourceList(module, resource, query),
    queryFn: () => enterpriseService.list(module, resource, query),
  })
  const invalidate = () =>
    client.invalidateQueries({ queryKey: queryKeys.resource(module, resource) })
  const update = useMutation({
    mutationFn: ({ id, nextStatus }: { id: string; nextStatus: string }) =>
      enterpriseService.update(module, resource, id, { status: nextStatus }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => enterpriseService.remove(module, resource, id),
    onSuccess: async () => {
      await invalidate()
      await client.invalidateQueries({ queryKey: ["trash"] })
    },
  })
  return {
    records: result.data ?? [],
    loading: result.isLoading,
    error: result.error instanceof Error ? result.error.message : null,
    updateStatus: (id: string, nextStatus: string) =>
      update.mutateAsync({ id, nextStatus }),
    remove: remove.mutateAsync,
  }
}
