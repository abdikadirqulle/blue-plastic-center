"use client"

import { Link } from "@/components/routing"
import { useState } from "react"
import { z } from "zod"
import {
  Bell,
  Building2,
  Calculator,
  ChevronRight,
  CircleDollarSign,
  GitBranch,
  LockKeyhole,
  Receipt,
  Save,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react"
import { AppShell } from "../../components/layout/app-shell"
import { Card } from "../../components/ui/card"
import { DatePicker } from "../../components/ui/date-picker"
import { Select } from "../../components/ui/select"
import { Toast, type ToastMessage } from "../../components/ui/toast"
import { cn } from "../../lib/utils"

const sections = [
  {
    slug: "company",
    label: "Company",
    description: "Legal profile and contact information",
    icon: Building2,
  },
  {
    slug: "branches",
    label: "Branches",
    description: "Locations, entities and warehouses",
    icon: GitBranch,
  },
  {
    slug: "users-roles",
    label: "Users & roles",
    description: "Access, roles and permissions",
    icon: Users,
  },
  {
    slug: "currencies",
    label: "Currencies",
    description: "Home currency and exchange rates",
    icon: CircleDollarSign,
  },
  {
    slug: "taxes",
    label: "Taxes",
    description: "Sales tax codes and agencies",
    icon: Receipt,
  },
  {
    slug: "workflows",
    label: "Workflows",
    description: "Approvals and transaction controls",
    icon: ShieldCheck,
  },
  {
    slug: "accounting-controls",
    label: "Accounting controls",
    description: "Closing, numbering and posting policies",
    icon: Calculator,
  },
  {
    slug: "security",
    label: "Security",
    description: "Authentication, sessions and audit retention",
    icon: LockKeyhole,
  },
  {
    slug: "integrations",
    label: "Integrations",
    description: "API, bank, email and external services",
    icon: Settings2,
  },
]

const details: Record<
  string,
  {
    title: string
    description: string
    groups: Array<{ title: string; fields: Array<[string, string, string]> }>
  }
> = {
  company: {
    title: "Company settings",
    description:
      "Information shown on transactions, reports and statutory documents.",
    groups: [
      {
        title: "Company identity",
        fields: [
          ["Legal company name", "BLUE PLASTIC CENTER", "text"],
          ["Trading name", "BLUE PLASTIC CENTER", "text"],
          ["Registration number", "BPC-2026-001", "text"],
          ["Tax ID", "SO-TAX-45091", "text"],
        ],
      },
      {
        title: "Contact & address",
        fields: [
          ["Company email", "finance@blueplastic.example", "email"],
          ["Phone", "+252 61 555 0100", "tel"],
          ["Website", "www.blueplastic.example", "text"],
          ["Registered address", "Maka Al Mukarama Road, Mogadishu", "text"],
        ],
      },
      {
        title: "Accounting preferences",
        fields: [
          ["Fiscal year starts", "2026-01-01", "date"],
          ["Accounting method", "Accrual", "select"],
          ["Home currency", "USD", "select"],
          ["Company timezone", "Africa/Mogadishu", "select"],
        ],
      },
    ],
  },
  branches: {
    title: "Branches & locations",
    description: "Configure operating branches and document numbering.",
    groups: [
      {
        title: "Main branch",
        fields: [
          ["Branch name", "Mogadishu Main", "text"],
          ["Branch code", "MGQ", "text"],
          ["Branch manager", "Abdisalam", "text"],
          ["Default warehouse", "Bakaaro Central", "select"],
        ],
      },
      {
        title: "Numbering",
        fields: [
          ["Invoice prefix", "BPC-INV", "text"],
          ["Bill prefix", "BPC-BILL", "text"],
          ["Journal prefix", "BPC-JE", "text"],
          ["Next invoice number", "10042", "number"],
        ],
      },
    ],
  },
  "users-roles": {
    title: "Users, roles & permissions",
    description:
      "Control who can view, create, approve and delete financial records.",
    groups: [
      {
        title: "Default access",
        fields: [
          ["New user role", "Viewer", "select"],
          ["Session timeout (minutes)", "60", "number"],
          ["Approval limit", "10000", "number"],
          ["Restrict users by branch", "Enabled", "select"],
        ],
      },
      {
        title: "Security",
        fields: [
          ["Require two-factor authentication", "Enabled", "select"],
          ["Password expiry (days)", "90", "number"],
          ["Login alerts", "Enabled", "select"],
          ["Audit user changes", "Enabled", "select"],
        ],
      },
    ],
  },
  currencies: {
    title: "Currency settings",
    description: "Manage home currency and multicurrency behavior.",
    groups: [
      {
        title: "Currency preferences",
        fields: [
          ["Home currency", "USD", "select"],
          ["Enable multicurrency", "Enabled", "select"],
          ["Rate source", "Manual", "select"],
          ["Decimal precision", "2", "number"],
        ],
      },
      {
        title: "Exchange rates",
        fields: [
          ["USD to SOS", "28500", "number"],
          ["EUR to USD", "1.08", "number"],
          ["GBP to USD", "1.29", "number"],
          ["Rate date", "2026-07-26", "date"],
        ],
      },
    ],
  },
  taxes: {
    title: "Tax settings",
    description:
      "Configure tax agencies, rates, filing and transaction defaults.",
    groups: [
      {
        title: "Sales tax",
        fields: [
          ["Default sales tax", "Standard 5%", "select"],
          ["Tax payable account", "Sales Tax Payable", "select"],
          ["Prices include tax", "Disabled", "select"],
          ["Filing frequency", "Monthly", "select"],
        ],
      },
      {
        title: "Purchasing tax",
        fields: [
          ["Default purchase tax", "Input Tax 5%", "select"],
          ["Recoverable tax account", "Input Tax Receivable", "select"],
          ["Tax agency", "Ministry of Finance", "text"],
          ["Next filing date", "2026-08-15", "date"],
        ],
      },
    ],
  },
  workflows: {
    title: "Workflow settings",
    description: "Set review and approval controls for important transactions.",
    groups: [
      {
        title: "Sales approvals",
        fields: [
          ["Invoice approval threshold", "10000", "number"],
          ["Estimate approver", "Sales Manager", "select"],
          ["Credit note approver", "Finance Manager", "select"],
          ["Allow self-approval", "Disabled", "select"],
        ],
      },
      {
        title: "Purchasing approvals",
        fields: [
          ["Purchase order threshold", "5000", "number"],
          ["Bill approver", "Finance Manager", "select"],
          ["Expense approver", "Department Manager", "select"],
          ["Require attachments", "Enabled", "select"],
        ],
      },
    ],
  },
  "accounting-controls": {
    title: "Accounting controls",
    description:
      "Protect the general ledger with closing and posting policies.",
    groups: [
      {
        title: "Closing controls",
        fields: [
          ["Closing date", "2026-06-30", "date"],
          ["Closing date password", "Required", "select"],
          ["Warn on prior-period posting", "Enabled", "select"],
          ["Auto-reverse accruals", "Enabled", "select"],
        ],
      },
      {
        title: "General ledger",
        fields: [
          ["Require balanced journals", "Enabled", "select"],
          ["Journal approval threshold", "10000", "number"],
          ["Retained earnings account", "Retained Earnings", "select"],
          ["Default class tracking", "Required", "select"],
        ],
      },
    ],
  },
  security: {
    title: "Security & audit",
    description: "Company-wide authentication, access and audit policies.",
    groups: [
      {
        title: "Authentication",
        fields: [
          ["Require two-factor authentication", "Enabled", "select"],
          ["Session timeout (minutes)", "60", "number"],
          ["Password expiry (days)", "90", "number"],
          ["Trusted device duration (days)", "30", "number"],
        ],
      },
      {
        title: "Audit & retention",
        fields: [
          ["Audit retention (years)", "7", "number"],
          ["Log report exports", "Enabled", "select"],
          ["Log failed access", "Enabled", "select"],
          ["Security alert recipients", "finance@blueplastic.example", "email"],
        ],
      },
    ],
  },
  integrations: {
    title: "Integrations",
    description: "Connections for banking, communication and external systems.",
    groups: [
      {
        title: "API & webhooks",
        fields: [
          ["API access", "Enabled", "select"],
          ["Webhook signing", "Enabled", "select"],
          ["API rate limit per minute", "120", "number"],
          ["Webhook retry attempts", "5", "number"],
        ],
      },
      {
        title: "Connected services",
        fields: [
          ["Bank feed provider", "Connected", "select"],
          ["Transaction email delivery", "Enabled", "select"],
          ["Payroll payment file", "Enabled", "select"],
          ["Document storage", "Internal", "select"],
        ],
      },
    ],
  },
}

function SettingControl({
  label,
  initialValue,
  type,
}: {
  label: string
  initialValue: string
  type: string
}) {
  const [value, setValue] = useState(initialValue)
  const name = label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")
  const options = [
    initialValue,
    "Enabled",
    "Disabled",
    "Accrual",
    "Cash",
    "USD",
    "SOS",
    "EUR",
    "Viewer",
    "Manual",
    "Monthly",
    "Finance Manager",
    "Sales Manager",
    "Department Manager",
    "Standard 5%",
    "Input Tax 5%",
    "Sales Tax Payable",
    "Input Tax Receivable",
    "Ministry of Finance",
    "Bakaaro Central",
  ].filter((item, index, array) => array.indexOf(item) === index)

  if (type === "select")
    return (
      <Select
        name={name}
        value={value}
        onValueChange={setValue}
        options={options}
      />
    )
  if (type === "date")
    return <DatePicker name={name} value={value} onChange={setValue} />
  return (
    <input
      name={name}
      type={type}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"
    />
  )
}

export function SettingsPage({ activeSection }: { activeSection: string }) {
  const current = details[activeSection] ? activeSection : "company"
  const content = details[current]
  const [toast, setToast] = useState<ToastMessage | null>(null)

  return (
    <AppShell>
      <div className="mx-auto max-w-[1500px]">
        <div>
          <p className="mb-2 text-xs font-bold text-[#007DCC]">
            Administration
          </p>
          <h1 className="text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">
            Settings
          </h1>
          <p className="mt-1.5 text-sm text-[#6b7e8a]">
            Manage company preferences, controls, access and accounting
            defaults.
          </p>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[310px_minmax(0,1fr)]">
          <Card className="h-fit overflow-hidden p-2">
            {sections.map(({ slug, label, description, icon: Icon }) => (
              <Link
                key={slug}
                href={`/settings/${slug}`}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-3",
                  slug === current
                    ? "bg-[#eaf5fc] text-[#0069ad]"
                    : "text-[#435b67] hover:bg-[#f5f8fa]",
                )}
              >
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-xl",
                    slug === current ? "bg-white" : "bg-[#f0f4f7]",
                  )}
                >
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-bold">{label}</span>
                  <span className="mt-0.5 block truncate text-[10px] font-medium text-[#82939c]">
                    {description}
                  </span>
                </span>
                <ChevronRight size={15} />
              </Link>
            ))}
            <div className="mt-2 border-t border-[#e8eef2] p-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#435b67]">
                <LockKeyhole size={15} /> Advanced controls
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#435b67]">
                <Bell size={15} /> Notifications
              </div>
            </div>
          </Card>

          <div>
            <Card className="overflow-hidden">
              <div className="flex flex-col justify-between gap-3 border-b border-[#e8eef2] px-5 py-5 sm:flex-row sm:items-center md:px-6">
                <div>
                  <h2 className="text-lg font-bold text-[#203946]">
                    {content.title}
                  </h2>
                  <p className="mt-1 text-xs text-[#788b96]">
                    {content.description}
                  </p>
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-[#eaf5fc] text-[#007DCC]">
                  <Settings2 size={18} />
                </span>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  const values = Object.fromEntries(
                    new FormData(event.currentTarget),
                  )
                  const result = z
                    .record(
                      z.string().min(1, "All settings fields are required"),
                    )
                    .safeParse(values)
                  if (!result.success) {
                    setToast({
                      title: "Settings not saved",
                      description:
                        "Complete all settings fields before saving.",
                      variant: "error",
                    })
                    return
                  }
                  setToast({
                    title: "Settings saved",
                    description: `${content.title} were updated successfully.`,
                    variant: "success",
                  })
                  window.setTimeout(() => setToast(null), 3200)
                }}
                className="divide-y divide-[#e8eef2]"
              >
                {content.groups.map((group) => (
                  <section key={group.title} className="p-5 md:p-6">
                    <h3 className="text-sm font-bold text-[#29424e]">
                      {group.title}
                    </h3>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      {group.fields.map(([label, value, type]) => (
                        <label key={label} className="block">
                          <span className="mb-1.5 block text-xs font-bold text-[#526874]">
                            {label}
                          </span>
                          <SettingControl
                            label={label}
                            initialValue={value}
                            type={type}
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
                <div className="flex items-center justify-end gap-3 bg-[#f8fafc] p-4 md:px-6">
                  <button
                    type="reset"
                    className="h-10 rounded-xl border border-[#dce6ed] bg-white px-4 text-xs font-bold text-[#526874]"
                  >
                    Discard changes
                  </button>
                  <button
                    type="submit"
                    className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-5 text-xs font-bold text-white"
                  >
                    <Save size={15} /> Save settings
                  </button>
                </div>
              </form>
            </Card>
            <Toast message={toast} onClose={() => setToast(null)} />
          </div>
        </div>
      </div>
    </AppShell>
  )
}
