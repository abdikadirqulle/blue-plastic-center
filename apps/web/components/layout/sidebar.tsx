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
  Users,
  WalletCards,
  X,
} from "lucide-react"
import { cn } from "../../lib/utils"

export const navigation = [
  { label: "Overview", icon: LayoutDashboard, href: "/", sections: [] },
  {
    label: "Sales",
    icon: ShoppingCart,
    href: "/sales/invoices",
    sections: ["sales"],
  },
  {
    label: "Debts",
    icon: HandCoins,
    href: "/debts/receivables",
    sections: ["debts"],
  },
  {
    label: "Purchasing",
    icon: ReceiptText,
    href: "/purchasing/bills",
    sections: ["purchasing"],
  },
  {
    label: "Banking",
    icon: Landmark,
    href: "/banking/accounts",
    sections: ["banking"],
  },
  {
    label: "Items & inventory",
    icon: Boxes,
    href: "/inventory/items",
    sections: ["inventory"],
  },
  {
    label: "Accounting",
    icon: ClipboardList,
    href: "/accounting/chart-of-accounts",
    sections: ["accounting"],
  },
  {
    label: "Projects",
    icon: BarChart3,
    href: "/projects/projects",
    sections: ["projects"],
  },
  {
    label: "Payroll",
    icon: WalletCards,
    href: "/payroll/pay-runs",
    sections: ["payroll"],
  },
  {
    label: "Reports",
    icon: FileBarChart,
    href: "/reports/financial",
    sections: ["reports"],
  },
  {
    label: "Import data",
    icon: Database,
    href: "/import",
    sections: ["import"],
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
      {open ? (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-[#061625]/45 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[#071f33] text-white transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link
          href="/"
          className="flex h-[74px] items-center gap-3 border-b border-white/10 px-5"
          onClick={onClose}
        >
          <div className="grid size-10 place-items-center rounded-xl bg-[#007DCC] text-white shadow-lg shadow-black/20">
            <CircleDollarSign size={23} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <div className="text-[17px] font-bold tracking-[-0.02em]">
              BLUE PLASTIC CENTER
            </div>
            <div className="text-[11px] font-medium text-[#93abc0]">
              Business system
            </div>
          </div>
          <button
            type="button"
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-2 text-[#9bb0c1] hover:bg-white/10 lg:hidden"
            onClick={(event) => {
              event.preventDefault()
              onClose()
            }}
          >
            <X size={18} />
          </button>
        </Link>

        <button
          type="button"
          onClick={onCompany}
          className="mx-3 mt-4 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.055] p-3 text-left hover:bg-white/[0.09]"
        >
          <div className="grid size-9 place-items-center rounded-lg bg-white/10 text-sky-300">
            <Building2 size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-semibold">
              BLUE PLASTIC CENTER
            </div>
            <div className="mt-0.5 text-[10px] text-[#93abc0]">
              Main company
            </div>
          </div>
          <ChevronDown size={15} className="text-[#93abc0]" />
        </button>

        <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-3">
          <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f8ba1]">
            Workspace
          </p>
          {navigation.map(({ label, icon: Icon, href, sections }) => {
            const active =
              href === "/"
                ? pathname === "/"
                : (sections?.some((section) =>
                    pathname.startsWith(`/${section}`),
                  ) ?? pathname.startsWith(href))
            return (
              <Link
                key={label}
                href={href}
                onClick={onClose}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] font-medium transition",
                  active
                    ? "bg-[#007DCC] text-white shadow-sm"
                    : "text-[#b3c3cf] hover:bg-white/[0.07] hover:text-white",
                )}
              >
                <Icon size={18} strokeWidth={active ? 2.3 : 1.8} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link
            href="/settings/company"
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium",
              pathname.startsWith("/settings")
                ? "bg-[#007DCC] text-white"
                : "text-[#b3c3cf] hover:bg-white/[0.07] hover:text-white",
            )}
          >
            <Settings size={18} />
            Settings
          </Link>
          <Link
            href="/login"
            className="mt-2 flex items-center gap-3 rounded-xl p-3 hover:bg-white/[0.07]"
          >
            <div className="grid size-9 place-items-center rounded-full bg-[#dcefff] text-xs font-bold text-[#0063a3]">
              AK
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold">Abdisalam</div>
              <div className="truncate text-[10px] text-[#829caf]">
                Administrator
              </div>
            </div>
            <Users size={15} className="text-[#6f8ba1]" />
          </Link>
        </div>
      </aside>
    </>
  )
}
