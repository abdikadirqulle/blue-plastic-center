import { QueryClient } from "@tanstack/react-query"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
})

export const queryKeys = {
  session: ["session"] as const,
  resource: (module: string, resource: string) =>
    ["resource", module, resource] as const,
  resourceList: (
    module: string,
    resource: string,
    query: object,
  ) => ["resource", module, resource, "list", query] as const,
  resourceDetail: (module: string, resource: string, id: string) =>
    ["resource", module, resource, "detail", id] as const,
  resourceActivity: (module: string, resource: string, id: string) =>
    ["resource", module, resource, "activity", id] as const,
  trash: (query: object) => ["trash", query] as const,
}
