"use client"

import { Link } from "@/components/routing"
import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Building2, CircleDollarSign, GitBranch, Receipt, Save, Settings2, ShieldCheck, Users } from "lucide-react"
import { AppShell } from "../../components/layout/app-shell"
import { Card } from "../../components/ui/card"
import { Select } from "../../components/ui/select"
import { Toast, type ToastMessage } from "../../components/ui/toast"
import { apiClient } from "../../lib/api-client"
import { cn } from "../../lib/utils"
import { useResourceList, useResourceMutations } from "../resources/resource-api"

const definitions = {
  company: { label: "Company", description: "Legal identity and accounting defaults", icon: Building2, resource: "company-settings", fields: [["legalName", "Legal company name"], ["tradingName", "Trading name"], ["functionalCurrency", "Functional currency"], ["fiscalYearStartMonth", "Fiscal year start month"], ["accountingBasis", "Accounting basis"], ["timezone", "Timezone"]] },
  branches: { label: "Branches", description: "Operating entities and locations", icon: GitBranch, resource: "branches", fields: [["name", "Branch name"], ["code", "Branch code"], ["address", "Address"]] },
  "users-roles": { label: "Users & roles", description: "Authenticated database users", icon: Users, resource: "users", fields: [] },
  currencies: { label: "Currencies", description: "Currency and exchange-rate records", icon: CircleDollarSign, resource: "currencies", fields: [["code", "Currency code"], ["name", "Currency name"], ["symbol", "Symbol"], ["exchangeRate", "Exchange rate"]] },
  taxes: { label: "Taxes", description: "Tax codes used by transactions", icon: Receipt, resource: "tax-codes", fields: [["code", "Tax code"], ["name", "Tax name"], ["rate", "Rate"]] },
  workflows: { label: "Workflows", description: "Approval and transaction controls", icon: ShieldCheck, resource: "company-settings", fields: [["invoiceApprovalThreshold", "Invoice approval threshold"], ["purchaseApprovalThreshold", "Purchase approval threshold"], ["allowSelfApproval", "Allow self approval"]] },
  "accounting-controls": { label: "Accounting controls", description: "Posting and period policies", icon: Settings2, resource: "company-settings", fields: [["closeLockDate", "Close lock date"], ["requireBalancedJournals", "Require balanced journals"], ["defaultPaymentTerms", "Default payment terms"]] },
  security: { label: "Security", description: "Session and audit preferences", icon: ShieldCheck, resource: "company-settings", fields: [["sessionMinutes", "Session length (minutes)"], ["auditRetentionDays", "Audit retention (days)"], ["requireMfa", "Require MFA"]] },
  integrations: { label: "Integrations", description: "External service configuration", icon: Settings2, resource: "company-settings", fields: [["bankFeedProvider", "Bank feed provider"], ["emailProvider", "Email provider"], ["apiEnabled", "API enabled"]] },
} as const

type SectionKey = keyof typeof definitions

export function SettingsPage({ activeSection }: { activeSection: string }) {
  const current: SectionKey = activeSection in definitions ? activeSection as SectionKey : "company"
  const definition = definitions[current]
  const isUsers = current === "users-roles"
  const records = useResourceList("setup", definition.resource, { page: 1, pageSize: 100 })
  const users = useQuery({
    queryKey: ["auth", "users"],
    queryFn: () => apiClient.getPath<Array<{ id: string; email: string; displayName: string; role: string; active: boolean }>>("/v1/auth/users"),
    enabled: isUsers,
  })
  const mutations = useResourceMutations("setup", definition.resource)
  const record = records.data?.data[0]
  const [values, setValues] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<ToastMessage | null>(null)

  useEffect(() => {
    if (!record) return
    setValues(Object.fromEntries(definition.fields.map(([name]) => [name, String(record.data[name] ?? "")])))
  }, [record, definition.fields])

  const currentRecords = useMemo(() => records.data?.data ?? [], [records.data])
  const save = async () => {
    try {
      const data = Object.fromEntries(Object.entries(values).map(([key, value]) => [
        key,
        /month|rate|threshold|minutes|days/i.test(key) && value !== "" ? Number(value) : value === "true" ? true : value === "false" ? false : value,
      ]))
      if (record) await mutations.update.mutateAsync({ id: record.id, version: record.version, data })
      else await mutations.create.mutateAsync({ data, status: "active" })
      setToast({ title: "Settings saved", description: "Changes were persisted to PostgreSQL.", variant: "success" })
    } catch (error) {
      setToast({ title: "Settings not saved", description: error instanceof Error ? error.message : "Unable to save settings.", variant: "error" })
    }
  }

  return <AppShell>
    <div className="mx-auto max-w-[1400px]">
      <p className="text-xs font-bold text-[#007DCC]">Administration</p>
      <h1 className="mt-2 text-3xl font-bold text-[#142735]">Settings</h1>
      <p className="mt-2 text-sm text-[#6b7e8a]">All values on this page are loaded from and saved to the API.</p>
      <div className="mt-6 grid gap-4 xl:grid-cols-[290px_1fr]">
        <Card className="h-fit p-2">
          {Object.entries(definitions).map(([slug, item]) => {
            const Icon = item.icon
            return <Link key={slug} href={`/settings/${slug}`} className={cn("flex items-center gap-3 rounded-xl p-3", slug === current ? "bg-[#eaf5fc] text-[#0069ad]" : "text-[#435b67] hover:bg-[#f5f8fa]")}><Icon size={17}/><span><span className="block text-xs font-bold">{item.label}</span><span className="text-[10px] text-[#82939c]">{item.description}</span></span></Link>
          })}
        </Card>
        <Card className="overflow-hidden">
          <div className="border-b border-[#e8eef2] p-6"><h2 className="text-lg font-bold text-[#203946]">{definition.label}</h2><p className="mt-1 text-xs text-[#788b96]">{definition.description}</p></div>
          {isUsers ? <div className="grid gap-3 p-6 md:grid-cols-2">{users.data?.data.map((user) => <div key={user.id} className="rounded-xl border border-[#dfe7ed] p-4"><p className="text-sm font-bold text-[#29424e]">{user.displayName}</p><p className="mt-1 text-xs text-[#788b96]">{user.email}</p><p className="mt-3 text-xs font-bold text-[#007DCC]">{user.role} · {user.active ? "Active" : "Disabled"}</p></div>)}</div> :
          <div className="p-6">
            {currentRecords.length > 1 ? <div className="mb-5 flex flex-wrap gap-2">{currentRecords.map((item) => <span key={item.id} className="rounded-lg bg-[#eef8fe] px-3 py-2 text-xs font-bold text-[#007DCC]">{String(item.data.name ?? item.data.code ?? item.id)}</span>)}</div> : null}
            <div className="grid gap-4 md:grid-cols-2">{definition.fields.map(([name, label]) => <label key={name}><span className="mb-1.5 block text-xs font-bold text-[#526874]">{label}</span>{["accountingBasis", "functionalCurrency"].includes(name) ? <Select value={values[name] ?? ""} onValueChange={(value) => setValues((old) => ({ ...old, [name]: value }))} options={name === "accountingBasis" ? ["accrual", "cash"] : ["USD", "SOS", "EUR"]}/> : <input value={values[name] ?? ""} onChange={(event) => setValues((old) => ({ ...old, [name]: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC]"/>}</label>)}</div>
            <div className="mt-6 flex justify-end"><button onClick={() => void save()} disabled={mutations.create.isPending || mutations.update.isPending} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-5 text-xs font-bold text-white"><Save size={15}/>Save settings</button></div>
          </div>}
        </Card>
      </div>
      <Toast message={toast} onClose={() => setToast(null)}/>
    </div>
  </AppShell>
}
