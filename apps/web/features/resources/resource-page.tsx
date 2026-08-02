"use client";

import { Link } from "@/components/routing";
import { useRouter } from "@/components/routing";
import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "../../components/layout/app-shell";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { ConfirmDeleteDialog } from "../../components/ui/confirm-delete-dialog";
import { DatePicker } from "../../components/ui/date-picker";
import { Select } from "../../components/ui/select";
import { TableToolbar } from "../../components/ui/table-toolbar";
import { RowActionMenu } from "../../components/ui/row-action-menu";
import { TablePagination } from "../../components/ui/table-pagination";
import { DataTableSkeleton, ValueSkeleton } from "../../components/ui/skeleton";
import {
  Toast,
  type ToastMessage,
  type ToastVariant,
} from "../../components/ui/toast";
import { cn } from "../../lib/utils";
import {
  moduleDefinitions,
  type ResourceConfig,
  type ResourceRow,
} from "./resource-config";
import {
  recordIdentifier,
  useResourceList,
  useResourceMutations,
} from "./resource-api";
import { isNumericColumn, tableCellValue } from "./table-cell-value";

const badgeVariant = (status: string) => {
  if (["Paid", "Posted", "Active", "Approved", "Completed"].includes(status))
    return "success";
  if (["Overdue", "Rejected", "Low stock"].includes(status)) return "danger";
  if (["Pending", "Open", "Partially paid"].includes(status)) return "warning";
  return "neutral";
};

export function ResourcePage({ config }: { config: ResourceConfig }) {
  const router = useRouter();
  const moduleDefinition = moduleDefinitions[config.module];
  const keyFilterLabel = config.columns[1] ?? "Record";
  const allKeyOption = `All ${keyFilterLabel.toLowerCase()}${keyFilterLabel.endsWith("s") ? "" : "s"}`;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [keyValue, setKeyValue] = useState(allKeyOption);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rows, setRows] = useState<ResourceRow[]>([]);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ResourceRow | null>(null);
  const apiRows = useResourceList(config.module, config.slug, {
    page,
    pageSize,
    search,
    status: status === "All statuses" ? undefined : status,
  });
  const mutations = useResourceMutations(config.module, config.slug);

  useEffect(
    () => setPage(1),
    [search, status, keyValue, dateFrom, dateTo, config.slug],
  );

  useEffect(() => {
    if (!apiRows.data) return;
    setRows(
      apiRows.data.data.map((record) => {
        const cells = config.columns.map((column) =>
          tableCellValue(column, record.data, {
            [config.columns[0].toLowerCase()]: recordIdentifier(record),
          }),
        );
        return {
          id: record.id,
          displayId: cells[0],
          status: record.status,
          cells: cells.slice(1),
        };
      }),
    );
  }, [apiRows.data, config.columns]);
  const statusOptions = useMemo(
    () => [
      "All statuses",
      ...Array.from(new Set(rows.map((row) => row.status))),
    ],
    [rows],
  );
  const keyOptions = useMemo(
    () => [
      allKeyOption,
      ...Array.from(new Set(rows.map((row) => row.cells[0]))),
    ],
    [allKeyOption, rows],
  );
  const selectedStatus = statusOptions.includes(status)
    ? status
    : "All statuses";
  const selectedKeyValue = keyOptions.includes(keyValue)
    ? keyValue
    : allKeyOption;
  const dateColumnIndex = useMemo(() => {
    const columnIndex = config.columns.findIndex((column) =>
      /date$|due date|expected|submitted|updated|generated|week$/i.test(column),
    );
    return columnIndex > 0 ? columnIndex - 1 : -1;
  }, [config.columns]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        const text =
          `${row.displayId ?? ""} ${row.cells.join(" ")}`.toLowerCase();
        const rowDate =
          dateColumnIndex >= 0
            ? Date.parse(row.cells[dateColumnIndex] ?? "")
            : Number.NaN;
        const afterFrom =
          !dateFrom ||
          (dateColumnIndex >= 0 &&
            !Number.isNaN(rowDate) &&
            rowDate >= Date.parse(dateFrom));
        const beforeTo =
          !dateTo ||
          (dateColumnIndex >= 0 &&
            !Number.isNaN(rowDate) &&
            rowDate <= Date.parse(dateTo));
        return (
          text.includes(search.toLowerCase()) &&
          (selectedStatus === "All statuses" ||
            row.status === selectedStatus) &&
          (selectedKeyValue === allKeyOption ||
            row.cells[0] === selectedKeyValue) &&
          afterFrom &&
          beforeTo
        );
      }),
    [
      rows,
      search,
      selectedStatus,
      selectedKeyValue,
      dateFrom,
      dateTo,
      dateColumnIndex,
      allKeyOption,
    ],
  );

  const notify = (
    title: string,
    variant: ToastVariant = "info",
    description?: string,
  ) => {
    setToast({ title, variant, description });
    window.setTimeout(() => setToast(null), 3200);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-bold text-[#007DCC]">
              {config.moduleTitle}
            </p>
            <h1 className="text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">
              {config.title}
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm text-[#6b7e8a]">
              {config.description}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/${config.module}/${config.slug}/new`}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white hover:bg-[#0069ad]"
            >
              <Plus size={17} /> {config.primaryAction}
            </Link>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: `Total ${config.title.toLowerCase()}`,
              value: String(apiRows.data?.meta?.total ?? rows.length),
              helper: "All records",
            },
            {
              label: "Active",
              value: String(
                rows.filter((row) =>
                  [
                    "active",
                    "paid",
                    "posted",
                    "approved",
                    "completed",
                  ].includes(row.status.toLowerCase()),
                ).length,
              ),
              helper: "On this page",
            },
            {
              label: "Pending",
              value: String(
                rows.filter((row) =>
                  ["draft", "pending", "open"].includes(
                    row.status.toLowerCase(),
                  ),
                ).length,
              ),
              helper: "On this page",
            },
          ].map((stat) => (
            <Card key={stat.label} className="p-4">
              <p className="text-xs font-semibold text-[#71848f]">
                {stat.label}
              </p>
              {apiRows.isLoading ? (
                <ValueSkeleton className="mt-2" />
              ) : (
                <p className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#17303d]">
                  {stat.value}
                </p>
              )}
              <p className="mt-1 text-[11px] font-medium text-[#007DCC]">
                {stat.helper}
              </p>
            </Card>
          ))}
        </div>

        <Card className="mt-4 overflow-visible">
          <nav className="overflow-x-auto border-b border-[#e5ecf1] px-4">
            <div className="flex min-w-max gap-1">
              {moduleDefinition.resources.map((resource) => (
                <Link
                  key={resource.slug}
                  href={`/${config.module}/${resource.slug}`}
                  className={cn(
                    "border-b-2 px-3 py-4 text-xs font-bold",
                    resource.slug === config.slug
                      ? "border-[#007DCC] text-[#007DCC]"
                      : "border-transparent text-[#728691] hover:text-[#2e4653]",
                  )}
                >
                  {resource.label}
                </Link>
              ))}
            </div>
          </nav>

          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={config.searchPlaceholder}
            filterTitle={`Filter ${config.title}`}
            filterDescription={`Show ${config.title.toLowerCase()} by status, ${keyFilterLabel.toLowerCase()}, and transaction date.`}
            activeFilterCount={
              [
                status !== "All statuses",
                keyValue !== allKeyOption,
                Boolean(dateFrom),
                Boolean(dateTo),
              ].filter(Boolean).length
            }
            onResetFilters={() => {
              setStatus("All statuses");
              setKeyValue(allKeyOption);
              setDateFrom("");
              setDateTo("");
            }}
            columns={[...config.columns, "Status"]}
            rows={filteredRows.map((row) => [
              row.displayId ?? row.cells[0],
              ...row.cells,
              row.status,
            ])}
            fileName={`blue-plastic-${config.module}-${config.slug}`}
            filterContent={
              <>
                <label className="text-xs font-semibold text-[#405762]">
                  <span className="mb-1.5 block">Status</span>
                  <Select
                    value={selectedStatus}
                    onValueChange={setStatus}
                    options={statusOptions}
                    className="h-10 text-xs"
                  />
                </label>
                <label className="text-xs font-semibold text-[#405762]">
                  <span className="mb-1.5 block">{keyFilterLabel}</span>
                  <Select
                    value={selectedKeyValue}
                    onValueChange={setKeyValue}
                    options={keyOptions}
                    className="h-10 text-xs"
                  />
                </label>
                {dateColumnIndex >= 0 ? (
                  <label className="text-xs font-semibold text-[#405762]">
                    <span className="mb-1.5 block">From date</span>
                    <DatePicker value={dateFrom} onChange={setDateFrom} />
                  </label>
                ) : null}
                {dateColumnIndex >= 0 ? (
                  <label className="text-xs font-semibold text-[#405762]">
                    <span className="mb-1.5 block">To date</span>
                    <DatePicker value={dateTo} onChange={setDateTo} />
                  </label>
                ) : null}
              </>
            }
          />

          {apiRows.isLoading ? (
            <DataTableSkeleton
              columns={[...config.columns, "Status", "Actions"]}
            />
          ) : config.presentation === "cards" ? (
            <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredRows.map((row) => (
                <article
                  key={row.id}
                  className="group rounded-2xl border border-[#e1e9ee] bg-white p-4 transition hover:border-sky-200 hover:shadow-sm"
                >
                  <button
                    onClick={() =>
                      router.push(
                        `/${config.module}/${config.slug}/${encodeURIComponent(row.id)}`,
                      )
                    }
                    className="w-full text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7b8e98]">
                          {config.columns[0]}
                        </p>
                        <h3 className="mt-1 text-sm font-bold text-[#007DCC]">
                          {row.displayId ?? row.cells[0]}
                        </h3>
                      </div>
                      <Badge variant={badgeVariant(row.status)}>
                        {row.status}
                      </Badge>
                    </div>
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      {config.columns.slice(1).map((column, index) => (
                        <div
                          key={column}
                          className={
                            index === 0
                              ? "col-span-2 border-b border-[#edf1f4] pb-3"
                              : ""
                          }
                        >
                          <dt className="text-[9px] font-bold uppercase tracking-wide text-[#8a9aa3]">
                            {column}
                          </dt>
                          <dd className="mt-1 truncate text-xs font-semibold text-[#334b57]">
                            {row.cells[index] ?? "—"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </button>
                  <div className="mt-4 flex gap-2 border-t border-[#edf1f4] pt-3">
                    <Link
                      href={`/${config.module}/${config.slug}/${encodeURIComponent(row.id)}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#eef7fd] py-2 text-[11px] font-bold text-[#007DCC]"
                    >
                      <Eye size={13} /> View
                    </Link>
                    <Link
                      href={`/${config.module}/${config.slug}/new?edit=${encodeURIComponent(row.id)}`}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#e1e9ee] py-2 text-[11px] font-bold text-[#526874]"
                    >
                      <Pencil size={13} /> Edit
                    </Link>
                    <button
                      onClick={() => setDeleteTarget(row)}
                      aria-label={`Delete ${row.id}`}
                      className="grid size-8 place-items-center rounded-lg border border-red-100 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead>
                  <tr className="bg-[#f8fafc]">
                    {config.columns.map((column) => (
                      <th
                        key={column}
                        className={cn(
                          "border-b border-[#e5ecf1] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#788b96]",
                          isNumericColumn(column) && "text-right",
                        )}
                      >
                        {column}
                      </th>
                    ))}
                    <th className="border-b border-[#e5ecf1] px-5 py-3 text-[10px] font-bold uppercase tracking-[0.08em] text-[#788b96]">
                      Status
                    </th>
                    <th className="border-b border-[#e5ecf1] px-5 py-3 text-right text-[10px] font-bold uppercase tracking-[0.08em] text-[#788b96]">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={() =>
                        router.push(
                          `/${config.module}/${config.slug}/${encodeURIComponent(row.id)}`,
                        )
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter")
                          router.push(
                            `/${config.module}/${config.slug}/${encodeURIComponent(row.id)}`,
                          );
                      }}
                      className="cursor-pointer border-b border-[#edf1f4] outline-none hover:bg-[#f0f8fd] focus:bg-[#f0f8fd]"
                    >
                      <td className="px-5 py-4 text-xs font-bold text-[#007DCC]">
                        {row.displayId ?? row.cells[0]}
                      </td>
                      {row.cells
                        .slice(0, config.columns.length - 1)
                        .map((cell, index) => (
                          <td
                            key={`${row.id}-${index}`}
                            className={cn(
                              "px-5 py-4 text-xs font-semibold text-[#334b57]",
                              isNumericColumn(config.columns[index + 1] ?? "") &&
                                "text-right tabular-nums",
                            )}
                          >
                            {cell}
                          </td>
                        ))}
                      <td className="px-5 py-4">
                        <Badge variant={badgeVariant(row.status)}>
                          {row.status}
                        </Badge>
                      </td>
                      <td
                        className="px-5 py-4 text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <RowActionMenu
                          label={row.displayId ?? row.id}
                          viewHref={`/${config.module}/${config.slug}/${encodeURIComponent(row.id)}`}
                          editHref={`/${config.module}/${config.slug}/new?edit=${encodeURIComponent(row.id)}`}
                          onDelete={() => setDeleteTarget(row)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredRows.length ? (
                <div className="py-16 text-center text-sm font-semibold text-[#71848f]">
                  No matching records found.
                </div>
              ) : null}
            </div>
          )}
          <TablePagination
            page={page}
            pageSize={pageSize}
            total={apiRows.data?.meta?.total ?? filteredRows.length}
            totalPages={apiRows.data?.meta?.totalPages ?? 1}
            onPageChange={setPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
          />
        </Card>
      </div>

      <Toast message={toast} onClose={() => setToast(null)} />
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title={`Delete ${config.columns[0].toLowerCase()}?`}
        recordName={
          deleteTarget
            ? `${deleteTarget.displayId ?? deleteTarget.cells[0]} · ${deleteTarget.cells[0] ?? config.title}`
            : undefined
        }
        description={`This moves the selected ${config.title.toLowerCase()} record to Trash. It can be restored later.`}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const deletedId = deleteTarget.id;
          await mutations.remove.mutateAsync(deletedId);
          setRows((current) => current.filter((item) => item.id !== deletedId));
          setDeleteTarget(null);
          notify(
            "Record deleted",
            "success",
            `${deleteTarget.displayId ?? deleteTarget.cells[0]} was removed successfully.`,
          );
        }}
      />
    </AppShell>
  );
}
