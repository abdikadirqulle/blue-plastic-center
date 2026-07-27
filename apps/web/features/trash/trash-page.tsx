import { useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { RefreshCcw, RotateCcw, Search, Trash2 } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Toast, type ToastMessage } from "@/components/ui/toast"
import { apiClient } from "@/lib/api-client"
import { queryKeys } from "@/lib/query-client"
import { recordTitle } from "../resources/resource-api"

const modules = [
  "All modules",
  "sales",
  "debts",
  "purchasing",
  "inventory",
  "banking",
  "accounting",
  "projects",
  "payroll",
]

export function TrashPage() {
  const client = useQueryClient()
  const [search, setSearch] = useState("")
  const [module, setModule] = useState("All modules")
  const [message, setMessage] = useState<ToastMessage | null>(null)
  const query = useMemo(() => ({ search, module }), [search, module])
  const records = useQuery({
    queryKey: queryKeys.trash(query),
    queryFn: () => {
      const parameters = new URLSearchParams({ pageSize: "100" })
      if (search) parameters.set("search", search)
      if (module !== "All modules") parameters.set("module", module)
      return apiClient.listTrash(parameters.toString())
    },
  })
  const restore = useMutation({
    mutationFn: (id: string) => apiClient.restore(id),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ["trash"] })
      await client.invalidateQueries({
        queryKey: queryKeys.resource(
          result.data.module,
          result.data.resource,
        ),
      })
      setMessage({
        title: "Record restored",
        description: `${recordTitle(result.data)} is visible in ${result.data.resource} again.`,
        variant: "success",
      })
    },
    onError: (error) =>
      setMessage({
        title: "Restore failed",
        description: error instanceof Error ? error.message : "Unable to restore record.",
        variant: "error",
      }),
  })

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px]">
        <div className="flex items-start gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-red-50 text-red-600">
            <Trash2 size={22} />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[#007DCC]">
              Data recovery
            </p>
            <h1 className="mt-1 text-3xl font-bold tracking-[-0.04em] text-[#17303d]">
              Trash
            </h1>
            <p className="mt-1 text-sm text-[#71848f]">
              Deleted records remain safely stored and can be restored at any time.
            </p>
          </div>
        </div>

        <Card className="mt-6 overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-[#e5ecf1] p-4 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#82949e]" size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search deleted records"
                className="h-10 w-full rounded-xl border border-[#dce6ed] pl-9 pr-3 text-xs outline-none focus:border-[#007DCC]"
              />
            </div>
            <Select
              value={module}
              onValueChange={setModule}
              options={modules}
              className="h-10 min-w-44 text-xs"
            />
            <button
              onClick={() => void records.refetch()}
              className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6ed] px-3 text-xs font-bold text-[#526874]"
            >
              <RefreshCcw size={14} /> Refresh
            </button>
          </div>

          {records.isLoading ? (
            <div className="p-14 text-center text-sm text-[#71848f]">Loading Trash…</div>
          ) : records.isError ? (
            <div className="p-14 text-center text-sm font-semibold text-red-600">
              {records.error instanceof Error ? records.error.message : "Unable to load Trash."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left">
                <thead className="bg-[#f8fafc]">
                  <tr>
                    {["Record", "Module", "Resource", "Status", "Deleted at", "Action"].map((heading) => (
                      <th key={heading} className="border-b px-5 py-3 text-[10px] font-bold uppercase tracking-wide text-[#788b96]">
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {records.data?.data.map((record) => (
                    <tr key={record.id} className="border-b border-[#edf1f4]">
                      <td className="px-5 py-4">
                        <p className="text-xs font-bold text-[#29424e]">{recordTitle(record)}</p>
                        <p className="mt-1 font-mono text-[10px] text-[#82949e]">{record.id}</p>
                      </td>
                      <td className="px-5 py-4 text-xs capitalize">{record.module}</td>
                      <td className="px-5 py-4 text-xs">{record.resource}</td>
                      <td className="px-5 py-4"><Badge variant="neutral">{record.status}</Badge></td>
                      <td className="px-5 py-4 text-xs text-[#607681]">
                        {record.deletedAt ? new Date(record.deletedAt).toLocaleString() : "—"}
                      </td>
                      <td className="px-5 py-4">
                        <button
                          disabled={restore.isPending}
                          onClick={() => restore.mutate(record.id)}
                          className="flex items-center gap-2 rounded-xl bg-[#eaf5fc] px-3 py-2 text-xs font-bold text-[#007DCC] disabled:opacity-50"
                        >
                          <RotateCcw size={14} /> Restore
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!records.data?.data.length ? (
                <div className="p-16 text-center">
                  <Trash2 className="mx-auto text-[#b7c4cb]" size={28} />
                  <p className="mt-3 text-sm font-bold text-[#526874]">Trash is empty</p>
                  <p className="mt-1 text-xs text-[#82949e]">Deleted records will appear here.</p>
                </div>
              ) : null}
            </div>
          )}
        </Card>
      </div>
      <Toast message={message} onClose={() => setMessage(null)} />
    </AppShell>
  )
}
