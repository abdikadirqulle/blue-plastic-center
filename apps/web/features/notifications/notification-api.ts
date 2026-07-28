import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { ApiRecord } from "../../lib/api-client"
import { apiClient } from "../../lib/api-client"
import { queryKeys } from "../../lib/query-client"

export interface NotificationData extends Record<string, unknown> {
  title: string
  message: string
  category: string
  severity: "critical" | "warning" | "success" | "info"
  href: string
  actionRequired: boolean
  occurredAt: string
  recipientUserId?: string
  readAt?: string | null
}

export type NotificationRecord = ApiRecord<NotificationData>

export function useNotifications() {
  return useQuery({
    queryKey: queryKeys.resourceList("setup", "notifications", { page: 1, pageSize: 100 }),
    queryFn: () => apiClient.list<NotificationData>("setup", "notifications", "page=1&pageSize=100&order=desc"),
    refetchInterval: 60_000,
  })
}

export function useNotificationActions() {
  const client = useQueryClient()
  const invalidate = () => client.invalidateQueries({ queryKey: queryKeys.resource("setup", "notifications") })
  const markRead = useMutation({
    mutationFn: (record: NotificationRecord) => apiClient.update(
      "setup",
      "notifications",
      record.id,
      { ...record.data, readAt: new Date().toISOString() },
      record.version,
      "read",
    ),
    onSuccess: invalidate,
  })
  const markAllRead = useMutation({
    mutationFn: async (records: NotificationRecord[]) => {
      for (const record of records.filter((item) => item.status !== "read")) {
        await apiClient.update(
          "setup",
          "notifications",
          record.id,
          { ...record.data, readAt: new Date().toISOString() },
          record.version,
          "read",
        )
      }
    },
    onSuccess: invalidate,
  })
  return { markRead, markAllRead }
}
