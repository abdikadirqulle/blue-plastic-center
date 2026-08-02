"use client";

import { Link } from "@/components/routing";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "@/components/routing";
import {
  ArrowRight,
  BriefcaseBusiness,
  Calculator,
  CheckCircle2,
  Clock3,
  Landmark,
  LockKeyhole,
  Plus,
  WalletCards,
} from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { ConfirmDeleteDialog } from "../../../components/ui/confirm-delete-dialog";
import { Select } from "../../../components/ui/select";
import { TableToolbar } from "../../../components/ui/table-toolbar";
import { RowActionMenu } from "../../../components/ui/row-action-menu";
import { TablePagination } from "../../../components/ui/table-pagination";
import {
  DataTableSkeleton,
  ValueSkeleton,
} from "../../../components/ui/skeleton";
import { Toast, type ToastMessage } from "../../../components/ui/toast";
import type { ResourceConfig } from "../../resources/resource-config";
import {
  isModalCreateResource,
  WorkspaceCreateButton,
} from "../../resources/workspace-create-button";
import {
  isNumericColumn,
  tableCellValue,
} from "../../resources/table-cell-value";
import { summableValues } from "../../resources/record-value";
import { formatDecimal, sumDecimals } from "../../../lib/utils";
import type {
  EnterpriseModule,
  EnterpriseRecord,
} from "../domain/enterprise-record";
import { useEnterpriseRecords } from "../hooks/use-enterprise-records";
import { isNavigableResource } from "@blue-plastic/types";
import { apiClient } from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";

const tabs = {
  accounting: [
    ["chart-of-accounts", "Accounts"],
    ["journal-entries", "Journals"],
    ["registers", "Registers"],
    ["recurring", "Recurring"],
    ["fiscal-periods", "Periods"],
    ["close-center", "Close center"],
    ["budgets", "Budgets"],
    ["fixed-assets", "Fixed assets"],
    ["classes", "Classes"],
    ["audit-log", "Audit log"],
  ],
  projects: [
    ["projects", "Project center"],
    ["tasks", "Tasks"],
    ["time", "Time"],
    ["expenses", "Costs"],
    ["progress-billing", "Progress billing"],
    ["change-orders", "Change orders"],
    ["profitability", "Profitability"],
  ],
  payroll: [
    ["pay-runs", "Pay runs"],
    ["employees", "Employees"],
    ["timesheets", "Timesheets"],
    ["leave", "Leave"],
    ["loans", "Loans"],
    ["liabilities", "Liabilities"],
    ["benefits", "Benefits"],
    ["reports", "Reports"],
  ],
} satisfies Record<EnterpriseModule, string[][]>;

const meta = {
  accounting: {
    label: "General ledger & controls",
    icon: Calculator,
    gradient: "linear-gradient(120deg, #143c5a 0%, #08263a 100%)",
  },
  projects: {
    label: "Projects & job costing",
    icon: BriefcaseBusiness,
    gradient: "linear-gradient(120deg, #4c326d 0%, #25233f 100%)",
  },
  payroll: {
    label: "Payroll & workforce",
    icon: WalletCards,
    gradient: "linear-gradient(120deg, #265648 0%, #173830 100%)",
  },
};

const badgeVariant = (status: string) => {
  if (
    /posted|active|approved|complete|paid|service|profitable|reconciled|closed|ready/i.test(
      status,
    )
  )
    return "success";
  if (/blocked|risk|over budget|rejected|locked|inactive/i.test(status))
    return "danger";
  if (
    /pending|open|draft|review|progress|processing|due|maintenance|leave/i.test(
      status,
    )
  )
    return "warning";
  return "neutral";
};

export function EnterpriseWorkspacePage({
  config,
}: {
  config: ResourceConfig;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const enterpriseModule = config.module as EnterpriseModule;
  const resource = config.slug;
  const moduleMeta = meta[enterpriseModule];
  const Icon = moduleMeta.icon;
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [deleteTarget, setDeleteTarget] = useState<EnterpriseRecord | null>(
    null,
  );
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const { records, loading, error, updateStatus, remove } =
    useEnterpriseRecords(enterpriseModule, resource, search, status);
  const statusOptions = useMemo(
    () => [
      "All statuses",
      ...Array.from(new Set(records.map((record) => record.status))),
    ],
    [records],
  );
  const usesStandardTable = ![
    "close-center",
    "budgets",
    "fixed-assets",
    "projects",
    "profitability",
    "pay-runs",
    "employees",
    "audit-log",
  ].includes(resource);
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize));
  const pagedRecords = records.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [resource, search, status, pageSize]);
  useEffect(
    () => setPage((current) => Math.min(current, totalPages)),
    [totalPages],
  );
  const valued = summableValues(records);
  const totalValue = sumDecimals(valued);
  const activeCount = records.filter((record) =>
    /posted|active|approved|complete|paid|closed|ready/i.test(record.status),
  ).length;
  const attentionCount = records.filter((record) =>
    /blocked|risk|pending|open|draft|review|processing|due/i.test(
      record.status,
    ),
  ).length;
  const liveStats = [
    {
      label: `Total ${config.title.toLowerCase()}`,
      value: records.length.toLocaleString(),
      helper: "Live database records",
    },
    {
      label: "Recorded value",
      value: valued.length ? formatDecimal(totalValue) : "—",
      helper: "Current filtered result",
    },
    {
      label: "Active / complete",
      value: activeCount.toLocaleString(),
      helper: "Completed or active records",
    },
    {
      label: "Needs attention",
      value: attentionCount.toLocaleString(),
      helper: "Open, draft, or exception",
    },
  ];
  // Hidden between hero section and table — flip to true to restore.
  const showWorkspaceSummaries = false;
  const enterpriseCell = (record: EnterpriseRecord, column: string) =>
    tableCellValue(column, record.data, {
      document: record.id,
      name: record.name,
      account: record.name,
      amount: record.value,
      total: record.value,
      value: record.value,
      date: record.date,
      type: record.detail,
    });
  const notify = (title: string, description: string) => {
    setMessage({ title, description, variant: "success" });
    window.setTimeout(() => setMessage(null), 3000);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1600px]">
        <section
          className="overflow-hidden rounded-2xl text-white shadow-sm"
          style={{ background: moduleMeta.gradient }}
        >
          <div className="grid gap-5 px-5 py-6 lg:grid-cols-[1fr_auto] lg:px-7">
            <div className="flex gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
                <Icon size={23} />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-200">
                  {moduleMeta.label}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] md:text-[30px]">
                  {config.title}
                </h1>
                <p className="mt-1 max-w-2xl text-xs text-white/65">
                  {config.description}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isModalCreateResource(enterpriseModule, resource) ? (
                <WorkspaceCreateButton
                  module={enterpriseModule}
                  slug={resource}
                  label={config.primaryAction}
                />
              ) : (
                <Link
                  href={`/${enterpriseModule}/${resource}/new`}
                  className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold"
                >
                  <Plus size={15} />
                  {config.primaryAction}
                </Link>
              )}
            </div>
          </div>
          <nav className="flex overflow-x-auto border-t border-white/10 bg-black/10 px-3">
            {tabs[enterpriseModule]
              .filter(([slug]) => isNavigableResource(enterpriseModule, slug))
              .map(([slug, label]) => (
                <Link
                  key={slug}
                  href={`/${enterpriseModule}/${slug}`}
                  className={`shrink-0 border-b-2 px-3 py-3 text-[11px] font-semibold ${slug === resource ? "border-sky-300 text-white" : "border-transparent text-white/55"}`}
                >
                  {label}
                </Link>
              ))}
          </nav>
        </section>
        {showWorkspaceSummaries ? (
          <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {liveStats.map((stat, index) => (
              <Card key={stat.label} className="relative overflow-hidden p-4">
                <span
                  className={`absolute inset-y-0 left-0 w-1 ${["bg-[#007DCC]", "bg-emerald-500", "bg-amber-500", "bg-violet-500"][index]}`}
                />
                <p className="text-[10px] font-medium uppercase text-[#788b96]">
                  {stat.label}
                </p>
                {loading ? (
                  <ValueSkeleton className="mt-2 h-6" />
                ) : (
                  <p className="mt-2 text-xl font-semibold">{stat.value}</p>
                )}
                <p className="mt-1 text-[10px] text-[#607681]">{stat.helper}</p>
              </Card>
            ))}
          </section>
        ) : null}
        <Card className="mt-4 overflow-hidden">
          <TableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={config.searchPlaceholder}
            filterTitle={`Filter ${config.title}`}
            filterDescription={`Filter ${config.title.toLowerCase()} using the relevant accounting, project, or payroll status.`}
            activeFilterCount={status !== "All statuses" ? 1 : 0}
            onResetFilters={() => setStatus("All statuses")}
            columns={[...config.columns, "Status"]}
            rows={records.map((record) => [
              ...config.columns.map((column) => enterpriseCell(record, column)),
              record.status,
            ])}
            fileName={`blue-plastic-${enterpriseModule}-${resource}`}
            filterContent={
              <label className="text-xs font-semibold text-[#405762] sm:col-span-2">
                <span className="mb-1.5 block">{config.title} status</span>
                <Select
                  value={status}
                  onValueChange={setStatus}
                  options={
                    statusOptions.length ? statusOptions : ["All statuses"]
                  }
                />
              </label>
            }
          />
          {error ? (
            <div className="p-10 text-center text-red-600">{error}</div>
          ) : loading ? (
            <DataTableSkeleton
              columns={[...config.columns, "Status", "Actions"]}
            />
          ) : resource === "close-center" ? (
            <CloseCenter
              records={records}
              onComplete={(record) => {
                void updateStatus(record.id, "Complete");
                notify("Close task completed", record.name);
              }}
            />
          ) : resource === "budgets" ? (
            <BudgetCenter
              records={records}
              onOpen={(id) => router.push(`/accounting/budgets/${id}`)}
            />
          ) : resource === "fixed-assets" ? (
            <FixedAssetCenter
              records={records}
              onDepreciate={(record) =>
                notify(
                  "Depreciation posted",
                  `${record.name} was included in JE-3094.`,
                )
              }
            />
          ) : resource === "projects" || resource === "profitability" ? (
            <ProjectCenter
              records={records}
              onOpen={(id) =>
                router.push(`/${enterpriseModule}/${resource}/${id}`)
              }
            />
          ) : resource === "pay-runs" ? (
            <PayRunCenter
              records={records}
              onApprove={(record) => {
                void apiClient
                  .action(
                    `/v1/payroll/pay-runs/${encodeURIComponent(record.id)}/approve`,
                  )
                  .then(() => {
                    void queryClient.invalidateQueries({
                      queryKey: queryKeys.resource("payroll", "pay-runs"),
                    });
                    notify(
                      "Payroll approved",
                      `${record.name} is ready for payment.`,
                    );
                  })
                  .catch((error: unknown) =>
                    notify(
                      "Approval failed",
                      error instanceof Error
                        ? error.message
                        : "Unable to approve payroll.",
                    ),
                  );
              }}
            />
          ) : resource === "employees" ? (
            <EmployeeCenter
              records={records}
              onOpen={(id) => router.push(`/payroll/employees/${id}`)}
            />
          ) : resource === "audit-log" ? (
            <AuditTimeline records={records} />
          ) : (
            <EnterpriseTable
              config={config}
              records={pagedRecords}
              cellValue={enterpriseCell}
              onOpen={(id) =>
                router.push(`/${enterpriseModule}/${resource}/${id}`)
              }
              onDelete={setDeleteTarget}
            />
          )}
          {!loading && !error && usesStandardTable && records.length ? (
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={records.length}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          ) : null}
        </Card>
      </div>
      <Toast message={message} onClose={() => setMessage(null)} />
      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        title={`Move ${deleteTarget?.id} to Trash?`}
        recordName={deleteTarget?.name}
        description="The record remains stored and can be restored from Trash."
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void remove(deleteTarget.id);
          setDeleteTarget(null);
          notify("Moved to Trash", "The workspace was updated.");
        }}
      />
    </AppShell>
  );
}

function CloseCenter({
  records,
  onComplete,
}: {
  records: EnterpriseRecord[];
  onComplete: (record: EnterpriseRecord) => void;
}) {
  return (
    <div className="p-4">
      <div className="mb-4 rounded-2xl bg-[#eef7fd] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-[#007DCC]">
              July 2026 close
            </p>
            <h2 className="mt-1 text-lg font-bold">
              72% complete · 8 days remaining
            </h2>
          </div>
          <button className="rounded-xl bg-[#007DCC] px-4 py-2.5 text-xs font-bold text-white">
            Review close exceptions
          </button>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white">
          <div className="h-full w-[72%] rounded-full bg-[#007DCC]" />
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        {["Reconcile", "Review", "Finalize"].map((lane) => (
          <section key={lane} className="rounded-2xl bg-[#f6f8fa] p-3">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold">
              <LockKeyhole size={15} className="text-[#007DCC]" />
              {lane}
            </h3>
            {records
              .filter((_, index) =>
                lane === "Reconcile"
                  ? index < 2
                  : lane === "Review"
                    ? index >= 2 && index < 4
                    : index === 4,
              )
              .map((record) => (
                <article
                  key={record.id}
                  className="mb-2 rounded-xl border bg-white p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold">{record.name}</p>
                    <Badge variant={badgeVariant(record.status)}>
                      {record.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-[10px] text-[#82949e]">
                    {record.date} · Owner: Finance
                  </p>
                  {record.status !== "Complete" ? (
                    <button
                      onClick={() => onComplete(record)}
                      className="mt-3 w-full rounded-lg bg-[#eaf5fc] py-2 text-[10px] font-bold text-[#007DCC]"
                    >
                      Mark complete
                    </button>
                  ) : null}
                </article>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}

function BudgetCenter({
  records,
  onOpen,
}: {
  records: EnterpriseRecord[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="p-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left">
          <thead>
            <tr className="border-b bg-[#f8fafc]">
              {[
                "Budget",
                "Annual budget",
                "YTD actual",
                "YTD budget",
                "Variance",
                "Progress",
              ].map((item) => (
                <th
                  key={item}
                  className="px-4 py-3 text-[9px] uppercase text-[#788b96]"
                >
                  {item}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((record, index) => (
              <tr
                key={record.id}
                onClick={() => onOpen(record.id)}
                className="cursor-pointer border-b hover:bg-[#f3f9fd]"
              >
                <td className="px-4 py-4">
                  <p className="text-xs font-bold">{record.name}</p>
                  <p className="text-[10px] text-[#82949e]">{record.status}</p>
                </td>
                <td className="px-4 py-4 text-xs font-bold">{record.value}</td>
                <td className="px-4 py-4 text-xs">
                  {
                    ["$164,200", "$98,400", "$72,800", "$44,200", "$184,000"][
                      index
                    ]
                  }
                </td>
                <td className="px-4 py-4 text-xs">
                  {
                    ["$151,800", "$106,650", "$68,620", "$60,960", "$184,000"][
                      index
                    ]
                  }
                </td>
                <td
                  className={`px-4 py-4 text-xs font-bold ${record.metrics.variance.startsWith("-") ? "text-red-600" : "text-emerald-600"}`}
                >
                  {record.metrics.variance}
                </td>
                <td className="px-4 py-4">
                  <div className="h-2 w-28 rounded-full bg-[#edf2f5]">
                    <div
                      className="h-full rounded-full bg-[#007DCC]"
                      style={{ width: record.metrics.progress }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FixedAssetCenter({
  records,
  onDepreciate,
}: {
  records: EnterpriseRecord[];
  onDepreciate: (record: EnterpriseRecord) => void;
}) {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
      {records.map((record, index) => (
        <article key={record.id} className="rounded-2xl border p-4">
          <div className="flex items-start justify-between">
            <span className="grid size-10 place-items-center rounded-xl bg-indigo-50 text-indigo-700">
              <Landmark size={18} />
            </span>
            <Badge variant={badgeVariant(record.status)}>{record.status}</Badge>
          </div>
          <h3 className="mt-3 text-sm font-bold">{record.name}</h3>
          <p className="mt-1 text-[10px] text-[#82949e]">
            Asset no. FA-{1048 + index} · Straight line
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#f6f8fa] p-3">
              <p className="text-[9px] text-[#82949e]">Cost</p>
              <p className="mt-1 text-xs font-bold">{record.value}</p>
            </div>
            <div className="rounded-xl bg-[#f6f8fa] p-3">
              <p className="text-[9px] text-[#82949e]">Net book value</p>
              <p className="mt-1 text-xs font-bold">
                {
                  ["$242,180", "$84,220", "$184,000", "$36,400", "$18,900"][
                    index
                  ]
                }
              </p>
            </div>
          </div>
          <button
            onClick={() => onDepreciate(record)}
            className="mt-3 w-full rounded-xl bg-indigo-50 py-2.5 text-[10px] font-bold text-indigo-700"
          >
            Post depreciation
          </button>
        </article>
      ))}
    </div>
  );
}

function ProjectCenter({
  records,
  onOpen,
}: {
  records: EnterpriseRecord[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid gap-3 p-4 lg:grid-cols-2">
      {records.map((record, index) => (
        <article key={record.id} className="rounded-2xl border p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold text-violet-700">
                {record.id}
              </p>
              <h3 className="mt-1 text-sm font-bold">{record.name}</h3>
              <p className="mt-1 text-[10px] text-[#82949e]">{record.detail}</p>
            </div>
            <Badge variant={badgeVariant(record.status)}>{record.status}</Badge>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              ["Contract", record.value],
              [
                "Cost to date",
                ["$182K", "$94K", "$68K", "$42K", "$128K"][index],
              ],
              ["Margin", ["34%", "18%", "42%", "22%", "31%"][index]],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-[#f7f5fa] p-3">
                <p className="text-[9px] text-[#82949e]">{label}</p>
                <p className="mt-1 text-xs font-bold">{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 h-2 rounded-full bg-[#edf0f2]">
            <div
              className="h-full rounded-full bg-violet-600"
              style={{ width: record.metrics.progress }}
            />
          </div>
          <button
            onClick={() => onOpen(record.id)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-[10px] font-bold text-violet-700"
          >
            Open job cost center <ArrowRight size={13} />
          </button>
        </article>
      ))}
    </div>
  );
}

function PayRunCenter({
  records,
  onApprove,
}: {
  records: EnterpriseRecord[];
  onApprove: (record: EnterpriseRecord) => void;
}) {
  return (
    <div className="p-4">
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        {["Enter time", "Review payroll", "Approve", "Pay & file"].map(
          (label, index) => (
            <div
              key={label}
              className={`rounded-xl p-3 ${index < 2 ? "bg-emerald-50 text-emerald-700" : "bg-[#f5f8fa]"}`}
            >
              <div className="flex items-center gap-2">
                {index < 2 ? <CheckCircle2 size={15} /> : <Clock3 size={15} />}
                <p className="text-[10px] font-bold">{label}</p>
              </div>
            </div>
          ),
        )}
      </div>
      {records.map((record) => (
        <article
          key={record.id}
          className="mb-3 grid items-center gap-3 rounded-xl border p-4 md:grid-cols-[1fr_auto_auto_auto]"
        >
          <div>
            <p className="text-xs font-bold">{record.name}</p>
            <p className="mt-1 text-[10px] text-[#82949e]">
              {record.id} · Pay date {record.date}
            </p>
          </div>
          <div>
            <p className="text-[9px] text-[#82949e]">Net pay</p>
            <p className="text-sm font-bold">{record.value}</p>
          </div>
          <Badge variant={badgeVariant(record.status)}>{record.status}</Badge>
          {record.status === "Ready to approve" ? (
            <button
              onClick={() => onApprove(record)}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-[10px] font-bold text-white"
            >
              Approve payroll
            </button>
          ) : (
            <button className="rounded-xl border px-3 py-2 text-[10px] font-bold">
              View run
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function EmployeeCenter({
  records,
  onOpen,
}: {
  records: EnterpriseRecord[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid md:grid-cols-[310px_1fr]">
      <aside className="border-r bg-[#f8fafc] p-3">
        {records.map((record, index) => (
          <button
            key={record.id}
            onClick={() => onOpen(record.id)}
            className={`mb-2 flex w-full items-center gap-3 rounded-xl border p-3 text-left ${index === 0 ? "border-emerald-300 bg-white" : "border-transparent"}`}
          >
            <span className="grid size-9 place-items-center rounded-full bg-emerald-50 text-[10px] font-bold text-emerald-700">
              {record.name
                .split(" ")
                .map((part) => part[0])
                .join("")}
            </span>
            <span>
              <strong className="block text-xs">{record.name}</strong>
              <span className="text-[10px] text-[#82949e]">
                {record.status}
              </span>
            </span>
          </button>
        ))}
      </aside>
      <div className="p-5">
        <p className="text-[10px] font-bold uppercase text-emerald-700">
          Employee profile
        </p>
        <h2 className="mt-1 text-xl font-bold">Ahmed Hassan</h2>
        <p className="mt-1 text-xs text-[#71848f]">
          Production Supervisor · Employee EMP-1001
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            ["YTD gross pay", "$18,420"],
            ["Leave balance", "14 days"],
            ["Next net pay", "$2,180"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-[#f5f8f7] p-4">
              <p className="text-[10px] text-[#82949e]">{label}</p>
              <p className="mt-1 text-sm font-bold">{value}</p>
            </div>
          ))}
        </div>
        <h3 className="mt-6 text-xs font-bold">Payroll & HR activity</h3>
        {[
          "Timesheet approved · Week 30",
          "July payroll calculated",
          "Annual leave request approved",
        ].map((text) => (
          <div
            key={text}
            className="flex items-center gap-3 border-b py-3 text-xs"
          >
            <CheckCircle2 size={15} className="text-emerald-600" />
            {text}
            <span className="ml-auto text-[10px] text-[#82949e]">Jul 2026</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuditTimeline({ records }: { records: EnterpriseRecord[] }) {
  return (
    <div className="p-5">
      <div className="relative ml-3 border-l border-[#dfe7ec] pl-6">
        {records.map((record, index) => (
          <article
            key={record.id}
            className="relative mb-5 rounded-xl border p-4"
          >
            <span className="absolute -left-[31px] top-5 grid size-3 rounded-full border-2 border-white bg-[#007DCC]" />
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold">{record.name}</p>
                <p className="mt-1 text-[10px] text-[#82949e]">
                  Abdisalam · {record.date} · 10:{24 + index}
                </p>
              </div>
              <Badge variant={badgeVariant(record.status)}>
                {record.status}
              </Badge>
            </div>
            <p className="mt-3 rounded-lg bg-[#f7f9fa] p-3 text-[10px] text-[#607680]">
              Change captured with before/after values, company, branch, user,
              IP address and immutable event ID {record.id}.
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function EnterpriseTable({
  config,
  records,
  cellValue,
  onOpen,
  onDelete,
}: {
  config: ResourceConfig;
  records: EnterpriseRecord[];
  cellValue: (record: EnterpriseRecord, column: string) => string;
  onOpen: (id: string) => void;
  onDelete: (record: EnterpriseRecord) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left">
        <thead>
          <tr className="border-b bg-[#f8fafc]">
            {config.columns.map((column) => (
              <th
                key={column}
                className={`px-5 py-3 text-[9px] font-bold uppercase text-[#788b96] ${isNumericColumn(column) ? "text-right" : ""}`}
              >
                {column}
              </th>
            ))}
            <th className="px-5 py-3 text-[9px] uppercase">Status</th>
            <th className="px-5 py-3 text-right text-[9px] uppercase">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr
              key={record.id}
              onClick={() => onOpen(record.id)}
              className="cursor-pointer border-b hover:bg-[#f3f9fd]"
            >
              {config.columns.map((column, index) => (
                <td
                  key={column}
                  className={`px-5 py-4 text-xs ${index === 0 ? "font-bold text-[#007DCC]" : "font-medium text-[#405762]"} ${isNumericColumn(column) ? "text-right tabular-nums" : ""}`}
                >
                  {cellValue(record, column)}
                </td>
              ))}
              <td className="px-5 py-4">
                <Badge variant={badgeVariant(record.status)}>
                  {record.status}
                </Badge>
              </td>
              <td
                onClick={(event) => event.stopPropagation()}
                className="px-5 py-4 text-right"
              >
                <RowActionMenu
                  label={record.name}
                  viewHref={`/${config.module}/${config.slug}/${encodeURIComponent(record.id)}`}
                  editHref={`/${config.module}/${config.slug}/new?edit=${encodeURIComponent(record.id)}`}
                  onDelete={() => onDelete(record)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
