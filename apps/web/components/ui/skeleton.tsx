import { cn } from "../../lib/utils"

export function Skeleton({
  className,
}: {
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse rounded-md bg-gradient-to-r from-[#edf2f5] via-[#f7f9fa] to-[#edf2f5] bg-[length:200%_100%]",
        className,
      )}
    />
  )
}

export function ValueSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-7 w-28", className)} />
}

export function TableSkeletonRows({
  columns,
  rows = 5,
}: {
  columns: number
  rows?: number
}) {
  return (
    <>
      {Array.from({ length: rows }, (_, row) => (
        <tr key={row} className="border-b border-[#edf1f4]">
          {Array.from({ length: columns }, (_, column) => (
            <td key={column} className="px-5 py-4">
              <Skeleton
                className={cn(
                  "h-3.5",
                  column === 0
                    ? "w-28"
                    : column % 3 === 0
                      ? "w-16"
                      : "w-24",
                )}
              />
              {column === 0 ? <Skeleton className="mt-2 h-2.5 w-20" /> : null}
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export function CardContentSkeleton() {
  return (
    <div className="space-y-3" aria-label="Loading data" role="status">
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}

export function DataTableSkeleton({
  columns,
  rows = 5,
}: {
  columns: string[]
  rows?: number
}) {
  return (
    <div className="overflow-x-auto" role="status" aria-label="Loading table rows">
      <table className="w-full min-w-[820px] text-left">
        <thead className="bg-[#f8fafc]">
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className="border-b border-[#e5ecf1] px-5 py-3 text-[9px] font-semibold uppercase tracking-wide text-[#788b96]"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <TableSkeletonRows columns={columns.length} rows={rows} />
        </tbody>
      </table>
      <span className="sr-only">Loading table data</span>
    </div>
  )
}
