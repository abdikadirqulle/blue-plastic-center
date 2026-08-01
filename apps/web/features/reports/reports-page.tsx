"use client";

import { Link } from "@/components/routing";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  endOfMonth,
  format,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  subMonths,
  subYears,
} from "date-fns";
import {
  BarChart3,
  ChevronRight,
  Download,
  FileBarChart,
  Heart,
  Play,
  Search,
  Star,
  X,
  Trash2,
} from "lucide-react";
import { AppShell } from "../../components/layout/app-shell";
import { Card } from "../../components/ui/card";
import { DatePicker } from "../../components/ui/date-picker";
import { Select } from "../../components/ui/select";
import { Toast, type ToastMessage } from "../../components/ui/toast";
import { cn } from "../../lib/utils";
import { resolveReportDefinition } from "./report-registry";

const tabs = [
  ["financial", "Financial"],
  ["sales", "Sales"],
  ["purchasing", "Purchasing"],
];

const reportGroups: Record<
  string,
  Array<{ group: string; reports: string[] }>
> = {
  financial: [
    {
      group: "Business overview",
      reports: [
        "Profit and Loss",
        "Balance Sheet",
        "Statement of Cash Flows",
        "Trial Balance",
        "General Ledger",
        "Journal",
      ],
    },
    {
      group: "Company & financial",
      reports: [
        "Profit and Loss by Class",
        "Profit and Loss by Customer",
        "Balance Sheet Detail",
        "Cash Flow Forecast",
        "Budget vs Actuals",
        "Statement of Changes in Equity",
      ],
    },
    {
      group: "Accountant reports",
      reports: [
        "Account List",
        "Transaction Detail by Account",
        "Audit Trail",
        "Closing Date Exception",
        "Voided/Deleted Transactions",
        "Reconciliation Reports",
      ],
    },
  ],
  sales: [
    {
      group: "Sales & customers",
      reports: [
        "Sales by Customer Summary",
        "Sales by Customer Detail",
        "Sales by Item Summary",
        "Sales by Item Detail",
        "Sales by Rep Summary",
        "Open Invoices",
      ],
    },
    {
      group: "Receivables",
      reports: [
        "A/R Aging Summary",
        "A/R Aging Detail",
        "Customer Balance Summary",
        "Customer Balance Detail",
        "Collections Report",
        "Invoice List",
        "Unbilled Charges",
      ],
    },
  ],
  purchasing: [
    {
      group: "Expenses & vendors",
      reports: [
        "Expenses by Vendor Summary",
        "Expenses by Vendor Detail",
        "Purchases by Vendor Summary",
        "Purchases by Item Detail",
        "Vendor Contact List",
        "Open Purchase Orders",
      ],
    },
    {
      group: "Payables",
      reports: [
        "A/P Aging Summary",
        "A/P Aging Detail",
        "Vendor Balance Summary",
        "Vendor Balance Detail",
        "Unpaid Bills Detail",
        "Bill Payment List",
      ],
    },
  ],
  inventory: [
    {
      group: "Inventory",
      reports: [
        "Inventory Valuation Summary",
        "Inventory Valuation Detail",
        "Inventory Stock Status by Item",
        "Physical Inventory Worksheet",
        "Inventory Assembly Shortage",
        "Pending Builds",
      ],
    },
    {
      group: "Cost & movement",
      reports: [
        "Inventory Turnover",
        "Stock by Warehouse",
        "Item Profitability",
        "Lot and Serial Tracking",
        "Inventory Adjustments",
        "Reorder Report",
      ],
    },
  ],
  projects: [
    {
      group: "Projects & job costing",
      reports: [
        "Project Profitability Summary",
        "Project Profitability Detail",
        "Job Estimates vs Actuals",
        "Unbilled Costs by Project",
        "Committed Costs",
        "Work in Progress",
      ],
    },
    {
      group: "Time & progress billing",
      reports: [
        "Time by Project",
        "Time by Employee",
        "Progress Invoice Summary",
        "Change Order Log",
        "Project Cost by Vendor",
        "Project Margin by Customer",
      ],
    },
  ],
  assets: [
    {
      group: "Fixed assets",
      reports: [
        "Fixed Asset Listing",
        "Depreciation Schedule",
        "Asset Acquisitions",
        "Asset Disposals",
        "Net Book Value by Category",
        "Asset Location Report",
      ],
    },
    {
      group: "Asset accounting",
      reports: [
        "Depreciation Journal",
        "Accumulated Depreciation",
        "Asset Roll Forward",
      ],
    },
  ],
  payroll: [
    {
      group: "Payroll",
      reports: [
        "Payroll Summary",
        "Payroll Details",
        "Employee Earnings Summary",
        "Payroll Item Detail",
        "Payroll Liability Balances",
      ],
    },
    {
      group: "Employees",
      reports: [
        "Employee Contact List",
        "Time Activities by Employee",
        "Vacation and Sick Leave",
        "Deductions and Contributions",
        "Employee Loan Balances",
        "Department Payroll Summary",
      ],
    },
  ],
  custom: [
    {
      group: "My custom reports",
      reports: [
        "Monthly Management Pack",
        "Branch Performance",
        "Customer Credit Review",
        "Warehouse Margin Analysis",
        "Executive Cash Position",
        "Board Reporting Pack",
      ],
    },
    {
      group: "Scheduled reports",
      reports: [
        "Monday Sales Digest",
        "Month-end Financial Pack",
        "Weekly Collections",
        "Daily Cash Summary",
      ],
    },
  ],
};

export function ReportsPage({ activeTab }: { activeTab: string }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const currentTab = reportGroups[activeTab] ? activeTab : "financial";
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("This month-to-date");
  const [from, setFrom] = useState(
    format(startOfMonth(new Date()), "yyyy-MM-dd"),
  );
  const [to, setTo] = useState(today);
  const [basis, setBasis] = useState("Accrual");
  const [favorites, setFavorites] = useState<string[]>([
    "Profit and Loss",
    "Balance Sheet",
  ]);
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [runningReport, setRunningReport] = useState("");
  const [memorizedOpen, setMemorizedOpen] = useState(false);
  const [memorized, setMemorized] = useState<
    Array<{
      name: string;
      kind: string;
      from: string;
      to: string;
      basis: string;
    }>
  >(() => {
    try {
      return JSON.parse(
        localStorage.getItem("blue-plastic-memorized-reports") ?? "[]",
      );
    } catch {
      return [];
    }
  });

  const groups = reportGroups[currentTab]
    .map((group) => ({
      ...group,
      reports: group.reports.filter((report) =>
        report.toLowerCase().includes(query.toLowerCase()),
      ),
    }))
    .filter((group) => group.reports.length);

  const choosePeriod = (nextPeriod: string) => {
    setPeriod(nextPeriod);
    const now = new Date();
    const ranges: Record<string, [Date, Date]> = {
      Today: [now, now],
      "This week": [startOfWeek(now), now],
      "This month-to-date": [startOfMonth(now), now],
      "This month": [startOfMonth(now), endOfMonth(now)],
      "This quarter": [startOfQuarter(now), now],
      "This fiscal year": [startOfYear(now), now],
      "Last month": [
        startOfMonth(subMonths(now, 1)),
        endOfMonth(subMonths(now, 1)),
      ],
      "Last fiscal year": [
        startOfYear(subYears(now, 1)),
        new Date(startOfYear(now).getTime() - 86_400_000),
      ],
    };
    const range = ranges[nextPeriod];
    if (range) {
      setFrom(format(range[0], "yyyy-MM-dd"));
      setTo(format(range[1], "yyyy-MM-dd"));
    }
  };

  const run = (report: string) => {
    const definition = resolveReportDefinition(report);
    if (definition.status === "unsupported") {
      setMessage({
        title: "Report not available yet",
        description: definition.reason,
        variant: "info",
      });
      return;
    }
    setRunningReport(report);
    navigate(
      `/reports/view?${new URLSearchParams({ name: report, kind: definition.kind, from, to, basis: basis.toLowerCase() })}`,
    );
  };

  const memorize = (report: string) => {
    const definition = resolveReportDefinition(report);
    if (definition.status === "unsupported") {
      setMessage({
        title: "Report not available yet",
        description: definition.reason,
        variant: "info",
      });
      return;
    }
    const next = [
      ...memorized.filter((item) => item.name !== report),
      {
        name: report,
        kind: definition.kind,
        from,
        to,
        basis: basis.toLowerCase(),
      },
    ];
    setMemorized(next);
    localStorage.setItem(
      "blue-plastic-memorized-reports",
      JSON.stringify(next),
    );
    setMessage({
      title: "Report memorized",
      description: `${report} and its current filters were saved.`,
      variant: "success",
    });
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <p className="mb-2 text-xs font-bold text-[#007DCC]">
              Reports & insights
            </p>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-[#142735]">
              Reports
            </h1>
            <p className="mt-1.5 text-sm text-[#6b7e8a]">
              QuickBooks-style financial and operational reporting across every
              company and branch.
            </p>
          </div>
          <button
            onClick={() => setMemorizedOpen(true)}
            className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-bold text-white"
          >
            <Star size={16} /> Memorized reports{" "}
            <span className="rounded-full bg-white/20 px-1.5">
              {memorized.length}
            </span>
          </button>
        </div>

        <Card className="mt-6 overflow-hidden">
          <nav className="overflow-x-auto border-b border-[#e5ecf1] px-4">
            <div className="flex min-w-max">
              {tabs.map(([slug, label]) => (
                <Link
                  key={slug}
                  href={`/reports/${slug}`}
                  className={cn(
                    "border-b-2 px-4 py-3 text-xs font-medium",
                    slug === currentTab
                      ? "border-[#007DCC] text-[#007DCC]"
                      : "border-transparent text-[#71848f]",
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          </nav>
          <div className="grid gap-3 bg-[#f8fafc] p-4 lg:grid-cols-[1fr_auto_auto_auto]">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#80929d]"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find a report by name"
                className="h-11 w-full rounded-xl border border-[#dce6ed] bg-white pl-9 pr-3 text-xs outline-none focus:border-[#007DCC]"
              />
            </div>
            <Select
              value={period}
              onValueChange={choosePeriod}
              options={[
                "Today",
                "This week",
                "This month-to-date",
                "This month",
                "This quarter",
                "This fiscal year",
                "Last month",
                "Last fiscal year",
                "Custom",
              ]}
              className="min-w-44 text-xs"
            />
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <DatePicker
                value={from}
                onChange={(value) => {
                  setFrom(value);
                  setPeriod("Custom");
                }}
                placeholder="From date"
              />
              <span className="text-[#90a0a9]">—</span>
              <DatePicker
                value={to}
                onChange={(value) => {
                  setTo(value);
                  setPeriod("Custom");
                }}
                placeholder="To date"
              />
            </div>
            <Select
              value={basis}
              onValueChange={setBasis}
              options={["Accrual", "Cash"]}
              className="text-xs font-semibold"
            />
          </div>
        </Card>

        <Toast message={message} onClose={() => setMessage(null)} />

        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {groups.map((group) => (
            <Card key={group.group} className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-[#e8eef2] px-5 py-4">
                <span className="grid size-9 place-items-center rounded-xl bg-[#eaf5fc] text-[#007DCC]">
                  <FileBarChart size={17} />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-[#223b48]">
                    {group.group}
                  </h2>
                  <p className="text-[11px] text-[#80919b]">
                    {group.reports.length} available reports
                  </p>
                </div>
              </div>
              <div className="divide-y divide-[#edf1f4]">
                {group.reports.map((report) => {
                  const favorite = favorites.includes(report);
                  const definition = resolveReportDefinition(report);
                  const available = definition.status === "available";
                  return (
                    <div
                      key={report}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-[#f8fbfd]"
                    >
                      <BarChart3 size={16} className="text-[#738894]" />
                      <button
                        onClick={() => run(report)}
                        className="flex-1 text-left text-xs font-medium text-[#304954] disabled:cursor-not-allowed disabled:text-[#8da0aa]"
                        disabled={!available}
                      >
                        {report}
                        {!available ? (
                          <span className="ml-2 rounded-full bg-[#eef2f5] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#71848f]">
                            Coming soon
                          </span>
                        ) : null}
                      </button>
                      <button
                        aria-label={`${favorite ? "Remove" : "Add"} ${report} favorite`}
                        onClick={() =>
                          setFavorites((current) =>
                            favorite
                              ? current.filter((item) => item !== report)
                              : [...current, report],
                          )
                        }
                        className={
                          favorite ? "text-amber-500" : "text-[#a0adb5]"
                        }
                      >
                        <Heart
                          size={15}
                          fill={favorite ? "currentColor" : "none"}
                        />
                      </button>
                      <button
                        aria-label={`Memorize ${report}`}
                        title="Memorize report"
                        onClick={() => memorize(report)}
                        disabled={!available}
                        className="rounded-lg p-2 text-[#758995] hover:bg-amber-50 hover:text-amber-600"
                      >
                        <Star size={15} />
                      </button>
                      <button
                        aria-label={`Export ${report}`}
                        onClick={() => run(report)}
                        disabled={!available}
                        className="rounded-lg p-2 text-[#758995] hover:bg-[#eaf5fc] hover:text-[#007DCC] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Download size={15} />
                      </button>
                      <button
                        onClick={() => run(report)}
                        disabled={!available}
                        className="flex items-center gap-1 rounded-lg bg-[#eaf5fc] px-2.5 py-2 text-[11px] font-medium text-[#007DCC] disabled:cursor-not-allowed disabled:bg-[#eef2f5] disabled:text-[#8da0aa]"
                      >
                        {runningReport === report ? (
                          <span className="size-3 animate-spin rounded-full border-2 border-[#9bcdeb] border-t-[#007DCC]" />
                        ) : (
                          <Play size={13} />
                        )}{" "}
                        Run
                      </button>
                      <ChevronRight size={14} className="text-[#a0adb5]" />
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
        {memorizedOpen ? (
          <div
            className="fixed inset-0 z-[100] grid place-items-center bg-[#102b3a]/45 p-4"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setMemorizedOpen(false);
            }}
          >
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#e5ecf1] px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-[#18313e]">
                    Memorized reports
                  </h2>
                  <p className="mt-0.5 text-xs text-[#71848f]">
                    Saved report filters ready to run again.
                  </p>
                </div>
                <button
                  onClick={() => setMemorizedOpen(false)}
                  className="rounded-lg p-2 text-[#6f838e] hover:bg-[#f0f5f8]"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="max-h-[55vh] divide-y divide-[#edf1f4] overflow-y-auto">
                {memorized.length ? (
                  memorized.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-3 px-5 py-4"
                    >
                      <Star size={16} className="text-amber-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[#29434f]">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-[#7a8d97]">
                          {item.from} — {item.to} · {item.basis}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setMemorizedOpen(false);
                          navigate(
                            `/reports/view?${new URLSearchParams(item)}`,
                          );
                        }}
                        className="rounded-lg bg-[#eaf5fc] px-3 py-2 text-xs font-semibold text-[#007DCC]"
                      >
                        Run
                      </button>
                      <button
                        onClick={() => {
                          const next = memorized.filter(
                            (saved) => saved.name !== item.name,
                          );
                          setMemorized(next);
                          localStorage.setItem(
                            "blue-plastic-memorized-reports",
                            JSON.stringify(next),
                          );
                        }}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-14 text-center text-sm text-[#71848f]">
                    No memorized reports yet. Use the star beside a report to
                    save it.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
