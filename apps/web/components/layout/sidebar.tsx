"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BarChart3,
  Boxes,
  Building2,
  ChevronDown,
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
  WalletCards,
  X,
} from "lucide-react"
import { cn } from "../../lib/utils"

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
      ["Fiscal periods", "/accounting/fiscal-periods"],
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
      ["Progress billing", "/projects/progress-billing"],
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
      ["Custom", "/reports/custom"],
    ],
  },
]

export function Sidebar({
  open,
  onClose,
  onCompany,
}: {
  open: boolean
  onClose: () => void
  onCompany: () => void
}) {
  const pathname = usePathname()
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
                    )
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
                    <div className="invisible absolute left-0 top-full z-50 w-56 translate-y-1 rounded-xl border border-[#dce6ed] bg-white p-2 text-[#304954] opacity-0 shadow-2xl transition group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                      {links.map(([name, link]) => (
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
              )
            })}
          </nav>
          <button
            onClick={onCompany}
            className="flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-left"
          >
            <Building2 size={16} className="text-sky-300" />
            <span className="hidden xl:block">
              <strong className="block max-w-36 truncate text-[10px]">
                BLUE PLASTIC CENTER
              </strong>
              <span className="text-[9px] text-[#93abc0]">Main company</span>
            </span>
            <ChevronDown size={12} />
          </button>
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
        <button
          onClick={onCompany}
          className="m-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.06] p-3 text-left"
        >
          <Building2 size={18} />
          <span className="flex-1 text-xs font-bold">BLUE PLASTIC CENTER</span>
          <ChevronDown size={14} />
        </button>
        <nav className="flex-1 overflow-y-auto px-3 pb-5">
          {navigation.map(({ label, icon: Icon, href, sections, links }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : sections.some((section) => pathname.startsWith(`/${section}`))
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
            )
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
  )
}
