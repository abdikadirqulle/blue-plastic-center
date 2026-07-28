"use client"

import { Link } from "@/components/routing"
import { useRouter } from "@/components/routing"
import { type ReactNode, useEffect, useRef, useState } from "react"
import {
  Bell,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  UserRound,
  X,
} from "lucide-react"
import { Sidebar } from "./sidebar"
import { useNotificationActions, useNotifications } from "../../features/notifications/notification-api"
import { cn } from "../../lib/utils"

const createGroups = [
  {
    module: "Sales",
    links: [
      ["New invoice", "/sales/invoices/new"],
      ["Sales receipt", "/sales/sales-receipts/new"],
      ["Receive payment", "/sales/payments/new"],
      ["Estimate", "/sales/estimates/new"],
      ["Sales order", "/sales/sales-orders/new"],
      ["Credit memo", "/sales/credit-notes/new"],
    ],
  },
  {
    module: "Purchasing",
    links: [
      ["Vendor bill", "/purchasing/bills/new"],
      ["Purchase order", "/purchasing/purchase-orders/new"],
      ["Receive items", "/purchasing/receipts/new"],
      ["Pay bills", "/purchasing/bill-payments/new"],
      ["Vendor credit", "/purchasing/vendor-credits/new"],
    ],
  },
  {
    module: "Inventory",
    links: [
      ["Inventory item", "/inventory/items/new"],
      ["Stock adjustment", "/inventory/adjustments/new"],
      ["Pick list", "/inventory/fulfillment/new"],
      ["Assembly build", "/inventory/assemblies/new"],
      ["Stock transfer", "/inventory/transfers/new"],
    ],
  },
  {
    module: "Banking",
    links: [
      ["Bank transaction", "/banking/transactions/new"],
      ["Bank deposit", "/banking/deposits/new"],
      ["Transfer funds", "/banking/transfers/new"],
      ["Reconcile account", "/banking/reconciliation/new"],
      ["Write check", "/banking/checks/new"],
    ],
  },
  {
    module: "Accounting",
    links: [
      ["Journal entry", "/accounting/journal-entries/new"],
      ["Budget", "/accounting/budgets/new"],
      ["Fixed asset", "/accounting/fixed-assets/new"],
      ["Month-end close", "/accounting/close-center/new"],
      ["Account", "/accounting/chart-of-accounts/new"],
    ],
  },
  {
    module: "People & projects",
    links: [
      ["Project", "/projects/projects/new"],
      ["Change order", "/projects/change-orders/new"],
      ["Project time", "/projects/time/new"],
      ["Pay run", "/payroll/pay-runs/new"],
      ["Employee", "/payroll/employees/new"],
      ["Payroll liability", "/payroll/liabilities/new"],
    ],
  },
] as const

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifications, setNotifications] = useState(false)
  const [createMenu, setCreateMenu] = useState(false)
  const [profileMenu, setProfileMenu] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState("")
  const searchRef = useRef<HTMLInputElement>(null)
  const notificationQuery = useNotifications()
  const notificationActions = useNotificationActions()
  const notificationRecords = notificationQuery.data?.data ?? []
  const unreadNotifications = notificationRecords.filter((record) => record.status !== "read")

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setSearchOpen(true)
        window.setTimeout(() => searchRef.current?.focus(), 0)
      }
      if (event.key === "Escape") {
        setNotifications(false)
        setSearchOpen(false)
        setCreateMenu(false)
        setProfileMenu(false)
      }
    }
    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
  }, [])

  const runSearch = () => {
    const value = search.trim().toLowerCase()
    const routes: Record<string, string> = {
      invoice: "/sales/invoices",
      receipt: "/sales/sales-receipts",
      refund: "/sales/refund-receipts",
      statement: "/sales/statements",
      deposit: "/sales/deposits",
      estimate: "/sales/estimates",
      "sales order": "/sales/sales-orders",
      customer: "/sales/customers",
      vendor: "/purchasing/vendors",
      bill: "/purchasing/bills",
      bank: "/banking/accounts",
      item: "/inventory/items",
      stock: "/inventory/stock-levels",
      account: "/accounting/chart-of-accounts",
      journal: "/accounting/journal-entries",
      project: "/projects/projects",
      employee: "/payroll/employees",
      payroll: "/payroll/pay-runs",
      report: "/reports/financial",
    }
    const match = Object.entries(routes).find(([term]) => value.includes(term))
    router.push(
      match?.[1] ?? `/sales/invoices?search=${encodeURIComponent(search)}`,
    )
    setSearch("")
  }

  return (
    <div className="min-h-screen bg-[#f4f7fa]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        actions={
          <>
            <button
              type="button"
              aria-label="Open search"
              onClick={() => {
                setSearchOpen(true)
                setNotifications(false)
                setCreateMenu(false)
                setProfileMenu(false)
                window.setTimeout(() => searchRef.current?.focus(), 0)
              }}
              className="grid size-9 place-items-center rounded-full text-[#b8c7d2] transition hover:bg-white/10 hover:text-white"
            >
              <Search size={17} />
            </button>
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => {
                setNotifications((value) => !value)
                setCreateMenu(false)
                setProfileMenu(false)
                setSearchOpen(false)
              }}
              className="relative grid size-9 place-items-center rounded-full text-[#b8c7d2] transition hover:bg-white/10 hover:text-white"
            >
              <Bell size={17} />
              {unreadNotifications.length ? <span className="absolute right-0.5 top-0.5 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white ring-2 ring-[#071f33]">{Math.min(unreadNotifications.length, 9)}</span> : null}
            </button>
            <button
              type="button"
              aria-label="Create new"
              title="Create new"
              onClick={() => {
                setCreateMenu((value) => !value)
                setNotifications(false)
                setProfileMenu(false)
                setSearchOpen(false)
              }}
              className="grid size-9 place-items-center rounded-full bg-[#007DCC] text-white transition hover:bg-[#1695e3]"
            >
              <Plus size={18} />
            </button>
            <button
              type="button"
              aria-label="Open profile menu"
              onClick={() => {
                setProfileMenu((value) => !value)
                setNotifications(false)
                setCreateMenu(false)
                setSearchOpen(false)
              }}
              className="grid size-9 place-items-center rounded-full bg-[#dcefff] text-[10px] font-extrabold text-[#0063a3] ring-2 ring-white/10 transition hover:ring-sky-300"
            >
              AK
            </button>
          </>
        }
      />
      <div>
        <header className="sticky top-0 z-20 flex h-[58px] items-center gap-3 border-b border-[#dfe7ed] bg-white/95 px-4 backdrop-blur lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-lg border border-[#dfe7ed] p-2 text-[#445866] lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <span className="text-xs font-bold text-[#263f4b]">
            BLUE PLASTIC CENTER
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              aria-label="Open search"
              onClick={() => {
                setSearchOpen(true)
                window.setTimeout(() => searchRef.current?.focus(), 0)
              }}
              className="grid size-9 place-items-center rounded-full border border-[#dfe7ed] text-[#536a78]"
            >
              <Search size={17} />
            </button>
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => {
                setNotifications((value) => !value)
                setCreateMenu(false)
                setProfileMenu(false)
              }}
              className="relative grid size-9 place-items-center rounded-full border border-[#dfe7ed] bg-white text-[#536a78] hover:bg-[#f6f9fb]"
            >
              <Bell size={18} />
              {unreadNotifications.length ? <span className="absolute right-0 top-0 grid min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white ring-2 ring-white">{Math.min(unreadNotifications.length, 9)}</span> : null}
            </button>
            <button
              type="button"
              aria-label="Create new"
              onClick={() => {
                setCreateMenu((value) => !value)
                setNotifications(false)
                setProfileMenu(false)
              }}
              className="grid size-9 place-items-center rounded-full bg-[#007DCC] text-white shadow-sm hover:bg-[#0069ad]"
            >
              <Plus size={17} />
            </button>
            <button
              type="button"
              aria-label="Open profile menu"
              onClick={() => {
                setProfileMenu((value) => !value)
                setNotifications(false)
                setCreateMenu(false)
              }}
              className="grid size-9 place-items-center rounded-full bg-[#dcefff] text-[10px] font-extrabold text-[#0063a3]"
            >
              AK
            </button>
          </div>
        </header>

        {notifications || createMenu || profileMenu || searchOpen ? (
          <button
            type="button"
            aria-label="Close open menu"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => {
              setNotifications(false)
              setCreateMenu(false)
              setProfileMenu(false)
              setSearchOpen(false)
            }}
          />
        ) : null}

        {notifications ? (
          <div className="fixed right-4 top-[68px] z-50 w-[330px] rounded-2xl border border-[#dfe7ed] bg-white p-3 shadow-2xl md:right-7">
            <div className="flex items-center justify-between px-2 py-1">
              <div><h3 className="text-sm font-bold">Notifications</h3><p className="text-[10px] text-[#80919b]">{unreadNotifications.length} unread</p></div>
              <button
                aria-label="Close notifications"
                onClick={() => setNotifications(false)}
              >
                <X size={17} />
              </button>
            </div>
            {notificationQuery.isLoading ? <div className="space-y-2 py-2">{Array.from({length: 3}, (_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-[#eef3f6]"/>)}</div> : notificationRecords.slice(0, 4).map((record) => (
              <Link
                href={record.data.href}
                key={record.id}
                onClick={() => {
                  if (record.status !== "read") notificationActions.markRead.mutate(record)
                  setNotifications(false)
                }}
                className="mt-2 flex items-start gap-3 rounded-xl bg-[#f5f9fc] p-3 text-xs text-[#405561] hover:bg-[#eaf4fb]"
              >
                <span className={cn("mt-1 size-2 shrink-0 rounded-full", record.status === "read" ? "bg-[#bdc9cf]" : record.data.severity === "critical" ? "bg-red-500" : "bg-[#007DCC]")} />
                <span><strong className="block font-semibold">{record.data.title}</strong><span className="mt-1 line-clamp-2 block text-[10px] leading-4 text-[#7b8d97]">{record.data.message}</span></span>
              </Link>
            ))}
            {!notificationQuery.isLoading && !notificationRecords.length ? <p className="py-8 text-center text-xs text-[#80919b]">No notifications.</p> : null}
            <Link
              href="/notifications"
              onClick={() => setNotifications(false)}
              className="mt-2 flex items-center justify-center rounded-xl border border-[#dfe7ed] py-2.5 text-xs font-bold text-[#007DCC] hover:bg-[#eef7fd]"
            >
              View all notifications
            </Link>
          </div>
        ) : null}

        {searchOpen ? (
          <div className="fixed inset-x-4 top-[76px] z-50 mx-auto w-auto max-w-2xl rounded-2xl border border-[#dce6ed] bg-white p-3 shadow-2xl md:top-20">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                runSearch()
                setSearchOpen(false)
              }}
            >
              <div className="relative">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-[#007DCC]"
                  size={19}
                />
                <input
                  ref={searchRef}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search BLUE PLASTIC CENTER"
                  placeholder="Search invoices, customers, items, accounts, projects or reports…"
                  className="h-14 w-full rounded-xl border border-[#dce6ed] bg-[#f8fafc] pl-12 pr-16 text-sm outline-none focus:border-[#007DCC] focus:bg-white focus:ring-4 focus:ring-[#007DCC]/10"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md border bg-white px-2 py-1 text-[10px] text-[#78909f]">
                  Enter
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 px-1">
                {[
                  "Invoices",
                  "Customers",
                  "Items",
                  "Accounts",
                  "Projects",
                  "Employees",
                  "Reports",
                ].map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => setSearch(term)}
                    className="rounded-full bg-[#eef7fd] px-3 py-1.5 text-[10px] font-bold text-[#007DCC]"
                  >
                    {term}
                  </button>
                ))}
              </div>
            </form>
          </div>
        ) : null}

        {createMenu ? (
          <div className="fixed inset-x-4 top-[68px] z-50 mx-auto max-h-[calc(100vh-5rem)] w-auto max-w-[1180px] overflow-y-auto rounded-2xl border border-[#dfe7ed] bg-white p-4 shadow-2xl md:top-20">
            <div className="mb-3 flex items-center justify-between px-1">
              <div>
                <h3 className="text-sm font-bold text-[#263f4b]">Create new</h3>
                <p className="mt-0.5 text-[10px] text-[#82949e]">
                  Choose a transaction or master record
                </p>
              </div>
              <button
                aria-label="Close create menu"
                onClick={() => setCreateMenu(false)}
                className="grid size-8 place-items-center rounded-full bg-[#f3f6f8] text-[#607681]"
              >
                <X size={15} />
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {createGroups.map((group) => (
                <section
                  key={group.module}
                  className="rounded-xl bg-[#f7f9fb] p-2"
                >
                  <h4 className="px-2 py-2 text-[9px] font-extrabold uppercase tracking-[0.14em] text-[#71848f]">
                    {group.module}
                  </h4>
                  {group.links.map(([label, href]) => (
                    <Link
                      key={label}
                      href={href}
                      onClick={() => setCreateMenu(false)}
                      className="flex items-center justify-between rounded-lg px-2 py-2 text-[11px] font-bold text-[#3e5461] hover:bg-white hover:text-[#007DCC] hover:shadow-sm"
                    >
                      {label}
                      <Plus size={12} />
                    </Link>
                  ))}
                </section>
              ))}
            </div>
          </div>
        ) : null}

        {profileMenu ? (
          <div className="fixed right-4 top-[68px] z-50 w-64 rounded-2xl border border-[#dfe7ed] bg-white p-2.5 shadow-2xl md:right-7">
            <div className="flex items-center gap-3 rounded-xl bg-[#f5f9fc] p-3">
              <span className="grid size-10 place-items-center rounded-xl bg-[#dcefff] text-xs font-bold text-[#0063a3]">
                AK
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-[#2f4753]">
                  Abdisalam Abdulahi
                </p>
                <p className="mt-0.5 truncate text-[10px] text-[#82949e]">
                  Administrator · Main company
                </p>
              </div>
            </div>
            <Link
              href="/profile"
              onClick={() => setProfileMenu(false)}
              className="mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#405762] hover:bg-[#eef7fd]"
            >
              <UserRound size={15} /> My profile
            </Link>
            <Link
              href="/settings/company"
              onClick={() => setProfileMenu(false)}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-[#405762] hover:bg-[#eef7fd]"
            >
              <Settings size={15} /> Account settings
            </Link>
            <Link
              href="/login"
              className="mt-1 flex items-center gap-3 border-t border-[#edf1f4] px-3 py-3 text-xs font-semibold text-red-600"
            >
              <LogOut size={15} /> Sign out
            </Link>
          </div>
        ) : null}

        <main className="px-4 py-6 md:px-7 md:py-7">{children}</main>
      </div>
    </div>
  )
}
