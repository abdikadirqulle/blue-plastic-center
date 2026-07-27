import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-client"
import type { SalesQuery, SalesResource } from "../domain/sales-record"
import { salesService } from "../services/sales-service"

export function useSalesRecords(resource: SalesResource, query: SalesQuery) {
  const client = useQueryClient()
  const result = useQuery({
    queryKey: queryKeys.resourceList("sales", resource, query),
    queryFn: () => salesService.list(resource, query),
  })
  const removeMutation = useMutation({
    mutationFn: (id: string) => salesService.remove(resource, id),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: queryKeys.resource("sales", resource),
      })
      await client.invalidateQueries({ queryKey: ["trash"] })
    },
  })
  return {
    records: result.data ?? [],
    loading: result.isLoading,
    error: result.error instanceof Error ? result.error.message : null,
    reload: result.refetch,
    remove: removeMutation.mutateAsync,
  }
}
