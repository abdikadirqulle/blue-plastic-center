"use client";

import { Link } from "@/components/routing";
import { usePathname } from "@/components/routing";
import type { ReactNode } from "react";
import {
  BarChart3,
  Boxes,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Database,
  FileBarChart,
  HandCoins,
  Landmark,
  LayoutDashboard,
  ReceiptText,
  Settings,
  ShoppingCart,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { cn } from "../../lib/utils";

const navigation = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
    sections: [],
    links: [],
  },
  {
    label: "Sales",
    icon: ShoppingCart,
    href: "/sales/invoices",
    sections: ["sales"],
    links: [
      ["Sales center", "/sales/invoices"],
      ["Invoices", "/sales/invoices"],
      ["Sales receipts", "/sales/sales-receipts"],
      ["Customers", "/sales/customers"],
      ["Estimates", "/sales/estimates"],
      ["Sales orders", "/sales/sales-orders"],
      ["Receive payments", "/sales/payments"],
      ["Credit memos", "/sales/credit-notes"],
      ["Refund receipts", "/sales/refund-receipts"],
      ["Statements", "/sales/statements"],
      ["Deposits", "/sales/deposits"],
      ["Recurring invoices", "/sales/recurring-invoices"],
    ],
  },
  {
    label: "Purchasing",
    icon: ReceiptText,
    href: "/purchasing/bills",
    sections: ["purchasing"],
    links: [
      ["Bills", "/purchasing/bills"],
      ["Pay bills", "/purchasing/bill-payments"],
      ["Vendors", "/purchasing/vendors"],
      ["Purchase orders", "/purchasing/purchase-orders"],
      ["Item receipts", "/purchasing/receipts"],
      ["Vendor credits", "/purchasing/vendor-credits"],
      ["Expenses", "/purchasing/expenses"],
      ["Checks", "/purchasing/checks"],
      ["Approvals", "/purchasing/approvals"],
    ],
  },
  {
    label: "Inventory",
    icon: Boxes,
    href: "/inventory/items",
    sections: ["inventory"],
    links: [
      ["Items", "/inventory/items"],
      ["Stock levels", "/inventory/stock-levels"],
      ["Warehouses", "/inventory/warehouses"],
      ["Transfers", "/inventory/transfers"],
      ["Adjustments", "/inventory/adjustments"],
      ["Cycle counts", "/inventory/stock-counts"],
      ["Assemblies", "/inventory/assemblies"],
      ["Lots & serials", "/inventory/lots-serials"],
      ["Reorder planning", "/inventory/reorder-planning"],
      ["Pick, pack & ship", "/inventory/fulfillment"],
      ["Landed costs", "/inventory/landed-costs"],
    ],
  },
  {
    label: "Banking",
    icon: Landmark,
    href: "/banking/accounts",
    sections: ["banking"],
    links: [
      ["Accounts", "/banking/accounts"],
      ["Bank feeds", "/banking/bank-feeds"],
      ["Transactions", "/banking/transactions"],
      ["Bank rules", "/banking/bank-rules"],
      ["Deposits", "/banking/deposits"],
      ["Transfers", "/banking/transfers"],
      ["Checks", "/banking/checks"],
      ["Reconciliation", "/banking/reconciliation"],
      ["Cash flow", "/banking/cash-flow"],
    ],
  },
  {
    label: "Accounting",
    icon: ClipboardList,
    href: "/accounting/chart-of-accounts",
    sections: ["accounting"],
    links: [
      ["Chart of accounts", "/accounting/chart-of-accounts"],
      ["Journal entries", "/accounting/journal-entries"],
      ["Registers", "/accounting/registers"],
      ["Recurring transactions", "/accounting/recurring"],
      ["Fiscal periods", "/accounting/fiscal-periods"],
      ["Month-end close", "/accounting/close-center"],
      ["Budgets", "/accounting/budgets"],
      ["Fixed assets", "/accounting/fixed-assets"],
      ["Classes", "/accounting/classes"],
      ["Audit log", "/accounting/audit-log"],
    ],
  },
  {
    label: "Projects",
    icon: BarChart3,
    href: "/projects/projects",
    sections: ["projects"],
    links: [
      ["Projects", "/projects/projects"],
      ["Time", "/projects/time"],
      ["Project costs", "/projects/expenses"],
      ["Progress billing", "/projects/progress-billing"],
      ["Change orders", "/projects/change-orders"],
      ["Profitability", "/projects/profitability"],
    ],
  },
  {
    label: "Payroll",
    icon: WalletCards,
    href: "/payroll/pay-runs",
    sections: ["payroll"],
    links: [
      ["Pay runs", "/payroll/pay-runs"],
      ["Employees", "/payroll/employees"],
      ["Timesheets", "/payroll/timesheets"],
      ["Leave", "/payroll/leave"],
      ["Employee loans", "/payroll/loans"],
      ["Liabilities", "/payroll/liabilities"],
      ["Benefits", "/payroll/benefits"],
      ["Payroll reports", "/payroll/reports"],
    ],
  },
  {
    label: "Reports",
    icon: FileBarChart,
    href: "/reports/financial",
    sections: ["reports"],
    links: [
      ["Financial", "/reports/financial"],
      ["Sales", "/reports/sales"],
      ["Inventory", "/reports/inventory"],
      ["Projects & jobs", "/reports/projects"],
      ["Fixed assets", "/reports/assets"],
      ["Payroll", "/reports/payroll"],
      ["Custom", "/reports/custom"],
    ],
  },
  {
    label: "Trash",
    icon: Trash2,
    href: "/trash",
    sections: ["trash"],
    links: [],
  },
];

const reportNavigation = [
  {
    label: "Company & Financial",
    href: "/reports/financial",
    reports: [
      ["Profit & Loss Standard", "Profit and Loss", "profit-and-loss"],
      ["Profit & Loss Detail", "Profit and Loss", "profit-and-loss"],
      ["Balance Sheet", "Balance Sheet", "balance-sheet"],
      ["Statement of Cash Flows", "Statement of Cash Flows", "cash-flow"],
      ["Trial Balance", "Trial Balance", "trial-balance"],
      ["General Ledger", "General Ledger", "general-ledger"],
    ],
  },
  {
    label: "Customers & Receivables",
    href: "/reports/sales",
    reports: [
      ["A/R Aging Summary", "A/R Aging Summary", "receivables-aging"],
      ["A/R Aging Detail", "A/R Aging Detail", "receivables-aging"],
      [
        "Customer Balance Summary",
        "Customer Balance Summary",
        "sales-by-customer",
      ],
      ["Open Invoices", "Open Invoices", "invoice-list"],
      ["Collections Report", "Collections Report", "collections"],
      ["Transaction List by Customer", "Invoice List", "invoice-list"],
    ],
  },
  {
    label: "Sales",
    href: "/reports/sales",
    reports: [
      [
        "Sales by Customer Summary",
        "Sales by Customer Summary",
        "sales-by-customer",
      ],
      [
        "Sales by Customer Detail",
        "Sales by Customer Detail",
        "sales-by-customer",
      ],
      ["Sales by Item Summary", "Sales by Item Summary", "sales-by-item"],
      ["Sales by Item Detail", "Sales by Item Detail", "sales-by-item"],
      ["Sales by Rep Summary", "Sales by Rep Summary", "sales-by-customer"],
    ],
  },
  {
    label: "Jobs, Time & Mileage",
    href: "/reports/projects",
    reports: [
      [
        "Job Profitability Summary",
        "Project Profitability Summary",
        "audit-trail",
      ],
      [
        "Job Profitability Detail",
        "Project Profitability Detail",
        "audit-trail",
      ],
      [
        "Estimates vs. Actuals Summary",
        "Job Estimates vs Actuals",
        "audit-trail",
      ],
      ["Time by Job Summary", "Time by Project", "audit-trail"],
    ],
  },
  {
    label: "Vendors & Payables",
    href: "/reports/purchasing",
    reports: [
      ["A/P Aging", "A/P Aging Summary", "payables-aging"],
      ["A/P Aging Detail", "A/P Aging Detail", "payables-aging"],
      ["Vendor Balance Summary", "Vendor Balance Summary", "payables-aging"],
      ["Unpaid Bills Detail", "Unpaid Bills Detail", "payables-aging"],
      ["Transaction List by Vendor", "Vendor Balance Detail", "payables-aging"],
    ],
  },
  {
    label: "Purchases",
    href: "/reports/purchasing",
    reports: [
      [
        "Purchases by Vendor Summary",
        "Purchases by Vendor Summary",
        "payables-aging",
      ],
      [
        "Purchases by Vendor Detail",
        "Purchases by Vendor Detail",
        "payables-aging",
      ],
      [
        "Purchases by Item Detail",
        "Purchases by Item Detail",
        "inventory-valuation",
      ],
      ["Open Purchase Orders", "Open Purchase Orders", "payables-aging"],
    ],
  },
  {
    label: "Inventory",
    href: "/reports/inventory",
    reports: [
      [
        "Inventory valuation",
        "Inventory Valuation Summary",
        "inventory-valuation",
      ],
      ["Stock status", "Inventory Stock Status by Item", "inventory-valuation"],
    ],
  },
  {
    label: "Employees & Payroll",
    href: "/reports/payroll",
    reports: [
      ["Payroll Summary", "Payroll Summary", "audit-trail"],
      ["Payroll Item Detail", "Payroll Item Detail", "audit-trail"],
      ["Employee Earnings Summary", "Employee Earnings Summary", "audit-trail"],
      [
        "Payroll Liability Balances",
        "Payroll Liability Balances",
        "audit-trail",
      ],
    ],
  },
  {
    label: "Banking",
    href: "/reports/financial",
    reports: [
      ["Deposit Detail", "Deposit Detail", "general-ledger"],
      ["Check Detail", "Check Detail", "general-ledger"],
      ["Missing Checks", "Missing Checks", "general-ledger"],
      ["Reconciliation Discrepancy", "Reconciliation Reports", "audit-trail"],
    ],
  },
  {
    label: "Accountant",
    href: "/reports/financial",
    reports: [
      ["General Ledger", "General Ledger", "general-ledger"],
      ["Trial Balance", "Trial Balance", "trial-balance"],
      ["Audit Trail", "Audit Trail", "audit-trail"],
    ],
  },
] as const;

function reportHref(name: string, kind: string) {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  const from = `${to.slice(0, 8)}01`;
  return `/reports/view?${new URLSearchParams({ name, kind, from, to, basis: "accrual" })}`;
}

export function Sidebar({
  open,
  onClose,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <>
      <div className="sticky top-0 z-30 hidden border-b border-white/10 bg-[#071f33] text-white lg:block">
        <div className="mx-auto flex h-16 max-w-[1700px] items-center gap-4 px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-[#007DCC]">
              <CircleDollarSign size={21} />
            </span>
            <span className="leading-tight">
              <strong className="block text-[13px] tracking-[-0.02em]">
                BLUE PLASTIC CENTER
              </strong>
              <span className="text-[9px] text-[#93abc0]">Business system</span>
            </span>
          </Link>
          <nav className="flex min-w-0 flex-1 items-center justify-center gap-0.5">
            {navigation.map(({ label, href, sections, links }) => {
              const active =
                href === "/"
                  ? pathname === "/"
                  : sections.some((section) =>
                      pathname.startsWith(`/${section}`),
                    );
              return (
                <div key={label} className="group relative">
                  <Link
                    href={href}
                    className={cn(
                      "flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition",
                      active
                        ? "bg-[#007DCC] text-white"
                        : "text-[#b8c7d2] hover:bg-white/10 hover:text-white",
                    )}
                  >
                    {label}
                    {links.length ? <ChevronDown size={12} /> : null}
                  </Link>
                  {links.length ? (
                    <div
                      className={cn(
                        "invisible absolute top-full z-50 w-56 translate-y-1 rounded-xl border border-[#dce6ed] bg-white p-2 text-[#304954] opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100",
                        label === "Reports" ? "right-0" : "left-0",
                      )}
                    >
                      {label === "Reports"
                        ? reportNavigation.map((category) => (
                            <div
                              key={category.label}
                              className="group/report-category relative"
                            >
                              <Link
                                href={category.href}
                                className="flex items-center justify-between rounded-lg px-3 py-2.5 text-xs font-semibold hover:bg-[#eef7fd] hover:text-[#007DCC]"
                              >
                                {category.label}
                                <ChevronRight size={13} />
                              </Link>
                              <div className="invisible absolute right-full top-0 z-[60] w-60 rounded-xl border border-[#dce6ed] bg-white p-2 opacity-0 shadow-2xl transition group-hover/report-category:visible group-hover/report-category:opacity-100">
                                <Link
                                  href={category.href}
                                  className="mb-1 block rounded-lg border-b border-[#e8eef2] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-[#007DCC] hover:bg-[#eef7fd]"
                                >
                                  View all {category.label}
                                </Link>
                                {category.reports.map(
                                  ([reportLabel, reportName, kind]) => (
                                    <Link
                                      key={reportLabel}
                                      href={reportHref(reportName, kind)}
                                      className="block rounded-lg px-3 py-2 text-xs font-medium text-[#405762] hover:bg-[#eef7fd] hover:text-[#007DCC]"
                                    >
                                      {reportLabel}
                                    </Link>
                                  ),
                                )}
                              </div>
                            </div>
                          ))
                        : links.map(([name, link]) => (
                            <Link
                              key={`${name}-${link}`}
                              href={link}
                              className="block rounded-lg px-3 py-2 text-xs font-semibold hover:bg-[#eef7fd] hover:text-[#007DCC]"
                            >
                              {name}
                            </Link>
                          ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        </div>
      </div>

      {open ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-[#061625]/55 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[290px] flex-col bg-[#071f33] text-white transition-transform lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
          <CircleDollarSign className="text-sky-400" />
          <strong className="text-sm">BLUE PLASTIC CENTER</strong>
          <button
            aria-label="Close navigation"
            onClick={onClose}
            className="ml-auto p-2"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 pb-5">
          {navigation.map(({ label, icon: Icon, href, sections, links }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : sections.some((section) =>
                    pathname.startsWith(`/${section}`),
                  );
            return (
              <div key={label} className="mb-1">
                <Link
                  href={href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold",
                    active
                      ? "bg-[#007DCC]"
                      : "text-[#b8c7d2] hover:bg-white/10",
                  )}
                >
                  <Icon size={17} />
                  {label}
                </Link>
                {active && links.length ? (
                  <div className="ml-8 mt-1 border-l border-white/10 pl-2">
                    {links.map(([name, link]) => (
                      <Link
                        key={`${name}-${link}`}
                        href={link}
                        onClick={onClose}
                        className={cn(
                          "block rounded-lg px-3 py-2 text-[11px]",
                          pathname === link
                            ? "bg-white/10 text-white"
                            : "text-[#93abc0]",
                        )}
                      >
                        {name}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/10 p-3">
          <Link
            href="/import"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-[#b8c7d2]"
          >
            <Database size={17} />
            Import data
          </Link>
          <Link
            href="/settings/company"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-[#b8c7d2]"
          >
            <Settings size={17} />
            Settings
          </Link>
          <Link
            href="/debts/receivables"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs text-[#b8c7d2]"
          >
            <HandCoins size={17} />
            Debts
          </Link>
        </div>
      </aside>
    </>
  );
}
