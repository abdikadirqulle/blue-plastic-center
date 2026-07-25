"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  LogOut,
  Menu,
  Plus,
  Search,
  X,
} from "lucide-react";
import { Sidebar } from "./sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [companyMenu, setCompanyMenu] = useState(false);
  const [createMenu, setCreateMenu] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setNotifications(false);
        setCompanyMenu(false);
        setCreateMenu(false);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);

  const runSearch = () => {
    const value = search.trim().toLowerCase();
    const routes: Record<string, string> = {
      invoice: "/sales",
      customer: "/sales",
      vendor: "/purchasing",
      bill: "/purchasing",
      bank: "/banking",
      item: "/inventory",
      stock: "/inventory",
      account: "/accounting",
      journal: "/accounting",
      project: "/projects",
      employee: "/payroll",
      payroll: "/payroll",
      report: "/reports",
    };
    const match = Object.entries(routes).find(([term]) => value.includes(term));
    router.push(match?.[1] ?? `/sales?search=${encodeURIComponent(search)}`);
    setSearch("");
  };

  return (
    <div className="min-h-screen bg-[#f4f7fa]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onCompany={() => setCompanyMenu(true)}
      />
      <div className="lg:pl-[252px]">
        <header className="sticky top-0 z-20 flex h-[74px] items-center gap-3 border-b border-[#dfe7ed] bg-white/95 px-4 backdrop-blur md:px-7">
          <button
            type="button"
            aria-label="Open navigation"
            className="rounded-lg border border-[#dfe7ed] p-2 text-[#445866] lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <form
            className="relative hidden max-w-[460px] flex-1 sm:block"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch();
            }}
          >
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#78909f]" size={17} />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search Al-Furat"
              className="h-10 w-full rounded-xl border border-[#dfe7ed] bg-[#f8fafc] pl-10 pr-14 text-[13px] outline-none transition placeholder:text-[#90a1ad] focus:border-[#007DCC] focus:bg-white focus:ring-4 focus:ring-[#007DCC]/10"
              placeholder="Search invoices, contacts, items, or reports"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-[#d9e3ea] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#78909f]">
              ⌘ K
            </span>
          </form>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/reports")}
              className="hidden h-10 items-center gap-2 rounded-xl border border-[#dfe7ed] bg-white px-3 text-xs font-semibold text-[#435866] hover:bg-[#f6f9fb] md:flex"
            >
              <CalendarDays size={16} />
              Jul 1 – Jul 25
              <ChevronDown size={14} />
            </button>
            <button
              type="button"
              aria-label="Notifications"
              onClick={() => setNotifications((value) => !value)}
              className="relative grid size-10 place-items-center rounded-xl border border-[#dfe7ed] bg-white text-[#536a78] hover:bg-[#f6f9fb]"
            >
              <Bell size={18} />
              <span className="absolute right-2 top-2 size-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>
            <button
              type="button"
              aria-label="Create new"
              onClick={() => setCreateMenu((value) => !value)}
              className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-3.5 text-xs font-bold text-white shadow-sm hover:bg-[#0069ad]"
            >
              <Plus size={17} />
              <span className="hidden sm:inline">Create new</span>
            </button>
          </div>
        </header>

        {notifications ? (
          <div className="fixed right-4 top-[68px] z-50 w-[330px] rounded-2xl border border-[#dfe7ed] bg-white p-3 shadow-2xl md:right-7">
            <div className="flex items-center justify-between px-2 py-1">
              <h3 className="text-sm font-bold">Notifications</h3>
              <button aria-label="Close notifications" onClick={() => setNotifications(false)}>
                <X size={17} />
              </button>
            </div>
            {["3 invoices are overdue", "5 items are below reorder level", "Payroll approval is pending"].map((text) => (
              <Link
                href={text.includes("invoice") ? "/sales" : text.includes("items") ? "/inventory" : "/payroll"}
                key={text}
                onClick={() => setNotifications(false)}
                className="mt-2 flex items-start gap-3 rounded-xl bg-[#f5f9fc] p-3 text-xs font-medium text-[#405561] hover:bg-[#eaf4fb]"
              >
                <span className="mt-1 size-2 rounded-full bg-[#007DCC]" />
                {text}
              </Link>
            ))}
          </div>
        ) : null}

        {createMenu ? (
          <div className="fixed right-4 top-[68px] z-50 w-56 rounded-2xl border border-[#dfe7ed] bg-white p-2 shadow-2xl md:right-7">
            {[
              ["New invoice", "/sales?create=invoice"],
              ["Record expense", "/purchasing?create=bill"],
              ["Add item", "/inventory?create=item"],
              ["Journal entry", "/accounting?create=journal"],
            ].map(([label, href]) => (
              <Link
                key={label}
                href={href}
                onClick={() => setCreateMenu(false)}
                className="flex rounded-xl px-3 py-2.5 text-xs font-semibold text-[#3e5461] hover:bg-[#eef7fd] hover:text-[#0069ad]"
              >
                {label}
              </Link>
            ))}
          </div>
        ) : null}

        {companyMenu ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-[#061625]/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">Switch company</h2>
                  <p className="mt-1 text-xs text-[#758894]">Choose the books you want to work in.</p>
                </div>
                <button aria-label="Close company selector" onClick={() => setCompanyMenu(false)}>
                  <X size={19} />
                </button>
              </div>
              {["Al-Furat Group", "Al-Furat Logistics", "Al-Furat Retail"].map((company, index) => (
                <button
                  type="button"
                  key={company}
                  onClick={() => setCompanyMenu(false)}
                  className="mt-3 flex w-full items-center rounded-xl border border-[#dfe7ed] p-3 text-left hover:border-[#007DCC] hover:bg-[#f3f9fd]"
                >
                  <span className="grid size-9 place-items-center rounded-lg bg-[#e4f3fc] text-xs font-bold text-[#007DCC]">AF</span>
                  <span className="ml-3 flex-1 text-sm font-semibold">{company}</span>
                  {index === 0 ? <Check size={18} className="text-[#007DCC]" /> : null}
                </button>
              ))}
              <Link href="/login" className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-red-600">
                <LogOut size={15} /> Sign out
              </Link>
            </div>
          </div>
        ) : null}

        <main className="px-4 py-6 md:px-7 md:py-7">{children}</main>
      </div>
    </div>
  );
}
