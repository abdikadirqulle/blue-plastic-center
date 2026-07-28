"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Link } from "@/components/routing";
import {
  ArrowRight,
  Box,
  BriefcaseBusiness,
  CircleDollarSign,
  FileText,
  HandCoins,
  Landmark,
  PackageCheck,
  Receipt,
  TrendingDown,
  TrendingUp,
  UserRoundCheck,
  Users,
  WalletCards,
} from "lucide-react";
import { AppShell } from "../../../components/layout/app-shell";
import { Badge } from "../../../components/ui/badge";
import { Card } from "../../../components/ui/card";
import { Skeleton, ValueSkeleton } from "../../../components/ui/skeleton";
import { cn, formatCurrency } from "../../../lib/utils";
import { useResourceList } from "../../resources/resource-api";
import {
  DashboardDateRangePicker,
  type DashboardDateRange,
} from "./dashboard-date-range-picker";
import {
  IncomeExpenseChart,
  InventoryValueChart,
  ReceivablesChart,
} from "./dashboard-charts";

const sources = [
  {
    module: "sales",
    resource: "invoices",
    title: "Sales",
    href: "/sales/invoices",
    icon: FileText,
  },
  {
    module: "purchasing",
    resource: "bills",
    title: "Expenses",
    href: "/purchasing/bills",
    icon: Receipt,
  },
  {
    module: "banking",
    resource: "transactions",
    title: "Banking",
    href: "/banking/transactions",
    icon: Landmark,
  },
  {
    module: "inventory",
    resource: "items",
    title: "Inventory",
    href: "/inventory/items",
    icon: Box,
  },
  {
    module: "projects",
    resource: "projects",
    title: "Projects",
    href: "/projects/projects",
    icon: BriefcaseBusiness,
  },
  {
    module: "payroll",
    resource: "employees",
    title: "Employees",
    href: "/payroll/employees",
    icon: Users,
  },
] as const;

function amount(data: Record<string, unknown>) {
  for (const key of [
    "total",
    "amount",
    "balance",
    "currentBalance",
    "salesPrice",
    "budget",
  ]) {
    const value = Number(data[key]);
    if (Number.isFinite(value)) return value;
  }
  return 0;
}

function recordDate(data: Record<string, unknown>, fallback: string) {
  for (const key of [
    "invoiceDate",
    "billDate",
    "transactionDate",
    "date",
    "createdAt",
  ])
    if (data[key]) return String(data[key]).slice(0, 10);
  return fallback.slice(0, 10);
}

function recordTitle(data: Record<string, unknown>) {
  for (const key of [
    "documentNumber",
    "displayName",
    "name",
    "description",
    "reference",
    "sku",
  ])
    if (data[key]) return String(data[key]);
  return "Database record";
}

export function DashboardPage() {
  const today = format(new Date(), "yyyy-MM-dd");
  const [period, setPeriod] = useState<DashboardDateRange>({
    from: format(
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      "yyyy-MM-dd",
    ),
    to: today,
    label: "This month",
  });
  const invoices = useResourceList("sales", "invoices", {
    page: 1,
    pageSize: 100,
  });
  const bills = useResourceList("purchasing", "bills", {
    page: 1,
    pageSize: 100,
  });
  const banking = useResourceList("banking", "transactions", {
    page: 1,
    pageSize: 100,
  });
  const inventory = useResourceList("inventory", "items", {
    page: 1,
    pageSize: 100,
  });
  const projects = useResourceList("projects", "projects", {
    page: 1,
    pageSize: 100,
  });
  const employees = useResourceList("payroll", "employees", {
    page: 1,
    pageSize: 100,
  });
  const customers = useResourceList("sales", "customers", {
    page: 1,
    pageSize: 100,
  });
  const queries = [invoices, bills, banking, inventory, projects, employees];

  const modules = useMemo(
    () =>
      sources.map((source, index) => {
        const records = (queries[index].data?.data ?? []).filter((record) => {
          const date = recordDate(record.data, record.createdAt);
          return (
            (!period.from || date >= period.from) &&
            (!period.to || date <= period.to)
          );
        });
        return {
          ...source,
          records,
          total: records.length,
          value: records.reduce((sum, record) => sum + amount(record.data), 0),
          loading: queries[index].isLoading,
        };
      }),
    [period.from, period.to, ...queries.map((query) => query.data)],
  );

  const recent = modules
    .flatMap((source) =>
      source.records.map((record) => ({ ...record, href: source.href })),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 7);
  const anyLoading = queries.some((query) => query.isLoading);
  const chartKeys = Array.from(
    new Set(
      [...modules[0].records, ...modules[1].records].map((record) =>
        recordDate(record.data, record.createdAt).slice(0, 7),
      ),
    ),
  )
    .sort()
    .slice(-8);
  const chartPoints = (chartKeys.length ? chartKeys : [today.slice(0, 7)]).map(
    (key) => ({
      label: format(new Date(`${key}-01T00:00:00`), "MMM yy"),
      sales: modules[0].records
        .filter((record) =>
          recordDate(record.data, record.createdAt).startsWith(key),
        )
        .reduce((sum, record) => sum + amount(record.data), 0),
      expenses: modules[1].records
        .filter((record) =>
          recordDate(record.data, record.createdAt).startsWith(key),
        )
        .reduce((sum, record) => sum + amount(record.data), 0),
    }),
  );
  const invoiceValues = {
    paid: modules[0].records
      .filter((record) => /paid/i.test(record.status))
      .reduce((sum, record) => sum + amount(record.data), 0),
    open: modules[0].records
      .filter((record) => /open|sent|draft/i.test(record.status))
      .reduce((sum, record) => sum + amount(record.data), 0),
    overdue: modules[0].records
      .filter((record) => /overdue/i.test(record.status))
      .reduce((sum, record) => sum + amount(record.data), 0),
  };
  const inventoryValues = modules[3].records
    .map((record) => {
      const quantity = Number(
        record.data.openingQuantity ?? record.data.quantityOnHand ?? 0,
      );
      const cost = Number(record.data.purchaseCost ?? 0);
      return {
        name: recordTitle(record.data),
        quantity,
        value: quantity * cost,
      };
    })
    .sort((a, b) => b.value - a.value);
  const receivable = modules[0].records.reduce(
    (sum, record) => sum + Number(record.data.balanceDue ?? 0),
    0,
  );
  const payable = modules[1].records.reduce(
    (sum, record) => sum + Number(record.data.balanceDue ?? 0),
    0,
  );
  const inventoryValue = inventoryValues.reduce(
    (sum, item) => sum + item.value,
    0,
  );
  const overdueInvoices = modules[0].records.filter((record) =>
    /overdue/i.test(record.status),
  ).length;

  const summary = [
    {
      label: "Total sales",
      value: modules[0].value,
      helper: `${modules[0].total} invoices`,
      loading: invoices.isLoading,
      icon: TrendingUp,
      accent: "text-emerald-700",
      iconBg: "bg-emerald-50",
      line: "bg-emerald-500",
    },
    {
      label: "Total expenses",
      value: modules[1].value,
      helper: `${modules[1].total} bills`,
      loading: bills.isLoading,
      icon: TrendingDown,
      accent: "text-orange-700",
      iconBg: "bg-orange-50",
      line: "bg-orange-400",
    },
    {
      label: "Net income",
      value: modules[0].value - modules[1].value,
      helper: "Sales less expenses",
      loading: invoices.isLoading || bills.isLoading,
      icon: CircleDollarSign,
      accent:
        modules[0].value - modules[1].value < 0
          ? "text-red-700"
          : "text-emerald-700",
      iconBg:
        modules[0].value - modules[1].value < 0 ? "bg-red-50" : "bg-emerald-50",
      line:
        modules[0].value - modules[1].value < 0
          ? "bg-red-500"
          : "bg-emerald-500",
    },
    {
      label: "Cash activity",
      value: modules[2].value,
      helper: `${modules[2].total} transactions`,
      loading: banking.isLoading,
      icon: WalletCards,
      accent: "text-sky-700",
      iconBg: "bg-sky-50",
      line: "bg-sky-500",
    },
    {
      label: "Accounts receivable",
      value: receivable,
      helper: "Customers owe the business",
      loading: invoices.isLoading,
      icon: HandCoins,
      accent: "text-red-700",
      iconBg: "bg-red-50",
      line: "bg-red-500",
    },
    {
      label: "Accounts payable",
      value: payable,
      helper: "Outstanding vendor bills",
      loading: bills.isLoading,
      icon: Receipt,
      accent: "text-orange-700",
      iconBg: "bg-orange-50",
      line: "bg-orange-400",
    },
    {
      label: "Inventory at cost",
      value: inventoryValue,
      helper: `${modules[3].total} tracked items`,
      loading: inventory.isLoading,
      icon: PackageCheck,
      accent: "text-violet-700",
      iconBg: "bg-violet-50",
      line: "bg-violet-500",
    },
    {
      label: "Active customers",
      value: customers.data?.meta?.total ?? customers.data?.data.length ?? 0,
      helper: `${overdueInvoices} overdue invoices`,
      loading: customers.isLoading || invoices.isLoading,
      count: true,
      icon: UserRoundCheck,
      accent: overdueInvoices ? "text-red-700" : "text-teal-700",
      iconBg: overdueInvoices ? "bg-red-50" : "bg-teal-50",
      line: overdueInvoices ? "bg-red-500" : "bg-teal-500",
    },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-medium text-[#007DCC]">
              Company overview
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-[#142735]">
              Dashboard
            </h1>
            <p className="mt-1 text-sm text-[#6b7e8a]">
              A live view of sales, expenses, cash, and operations.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DashboardDateRangePicker value={period} onChange={setPeriod} />
            <Link
              href="/reports/financial"
              className="flex h-10 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-medium text-[#007DCC]"
            >
              Reports <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.map((stat) => {
            const StatIcon = stat.icon;
            return (
              <Card
                key={stat.label}
                className="relative overflow-hidden rounded-xl p-4"
              >
                <span
                  className={cn("absolute inset-y-0 left-0 w-0.5", stat.line)}
                />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-[#6d808c]">{stat.label}</p>
                    {stat.loading ? (
                      <ValueSkeleton className="mt-2 h-6" />
                    ) : (
                      <p
                        className={cn(
                          "mt-2 text-xl font-semibold tabular-nums",
                          stat.accent,
                        )}
                      >
                        {"count" in stat && stat.count
                          ? Number(stat.value).toLocaleString()
                          : formatCurrency(stat.value)}
                      </p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "grid size-9 shrink-0 place-items-center rounded-xl",
                      stat.iconBg,
                      stat.accent,
                    )}
                  >
                    <StatIcon size={17} />
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-[#718791]">
                  {stat.loading ? "\u00a0" : stat.helper}
                </p>
              </Card>
            );
          })}
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-[1.5fr_1fr]">
          <Card className="rounded-xl p-5">
            <IncomeExpenseChart
              points={chartPoints}
              loading={invoices.isLoading || bills.isLoading}
            />
          </Card>
          <Card className="rounded-xl p-5">
            <ReceivablesChart {...invoiceValues} loading={invoices.isLoading} />
          </Card>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_1fr]">
          <Card className="rounded-xl p-5">
            <InventoryValueChart
              items={inventoryValues}
              loading={inventory.isLoading}
            />
          </Card>
          <Card className="rounded-xl p-5">
            <h2 className="text-sm font-semibold text-[#233d49]">
              Cash and obligations
            </h2>
            <p className="mt-1 text-[11px] text-[#7a8e98]">
              Liquidity compared with money due
            </p>
            {banking.isLoading || invoices.isLoading || bills.isLoading ? (
              <Skeleton className="mt-6 h-36 w-full" />
            ) : (
              <div className="mt-6 space-y-5">
                {[
                  ["Cash activity", modules[2].value, "#007DCC"],
                  ["Receivables", receivable, "#10b981"],
                  ["Payables", payable, "#f59e0b"],
                ].map(([label, value, color]) => {
                  const maximum = Math.max(
                    modules[2].value,
                    receivable,
                    payable,
                    1,
                  );
                  return (
                    <div key={String(label)}>
                      <div className="mb-2 flex justify-between text-xs">
                        <span className="text-[#607681]">{label}</span>
                        <b>{formatCurrency(Number(value))}</b>
                      </div>
                      <div className="h-2.5 rounded-full bg-[#edf2f5]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(Number(value) / maximum) * 100}%`,
                            background: String(color),
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {modules.map(({ title, href, icon: Icon, total, value, loading }) => (
            <Card key={href} className="rounded-xl p-4">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-[#edf7fc] text-[#007DCC]">
                  <Icon size={17} />
                </span>
                <div className="flex-1">
                  <h2 className="text-sm font-medium text-[#29424e]">
                    {title}
                  </h2>
                  {loading ? (
                    <Skeleton className="mt-1 h-3 w-28" />
                  ) : (
                    <p className="text-[11px] text-[#788b96]">
                      {total} records · {formatCurrency(value)}
                    </p>
                  )}
                </div>
                <Link
                  href={href}
                  aria-label={`View all ${title}`}
                  className="text-[#007DCC]"
                >
                  <ArrowRight size={15} />
                </Link>
              </div>
            </Card>
          ))}
        </div>

        <Card className="mt-3 overflow-hidden rounded-xl">
          <div className="border-b border-[#edf1f4] px-5 py-3">
            <h2 className="text-sm font-semibold text-[#203540]">
              Recent activity
            </h2>
            <p className="mt-0.5 text-[11px] text-[#7c8f9a]">
              Latest records in the selected period
            </p>
          </div>
          <div className="divide-y divide-[#edf1f4]">
            {recent.map((record) => (
              <Link
                key={record.id}
                href={`${record.href}/${record.id}`}
                className="grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 hover:bg-[#f8fbfd]"
              >
                <div>
                  <p className="text-xs font-medium text-[#2b414c]">
                    {recordTitle(record.data)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#82939d]">
                    {record.module} / {record.resource} ·{" "}
                    {new Date(record.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={
                      record.status === "active" || record.status === "posted"
                        ? "success"
                        : "warning"
                    }
                  >
                    {record.status}
                  </Badge>
                  <ArrowRight size={14} className="text-[#007DCC]" />
                </div>
              </Link>
            ))}
            {anyLoading ? (
              Array.from(
                { length: Math.max(2, 5 - recent.length) },
                (_, index) => (
                  <div key={`skeleton-${index}`} className="px-5 py-4">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="mt-2 h-2.5 w-64" />
                  </div>
                ),
              )
            ) : !recent.length ? (
              <p className="p-8 text-center text-sm text-[#788b96]">
                No records in this date range.
              </p>
            ) : null}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
