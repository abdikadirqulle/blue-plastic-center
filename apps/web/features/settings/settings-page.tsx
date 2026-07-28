"use client"

import { Link } from "@/components/routing"
import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2, CircleDollarSign, GitBranch, KeyRound, LoaderCircle, Pencil, Plus, Receipt, Save, Settings2, ShieldCheck, Trash2, Users, X } from "lucide-react"
import { AppShell } from "../../components/layout/app-shell"
import { Card } from "../../components/ui/card"
import { ConfirmDeleteDialog } from "../../components/ui/confirm-delete-dialog"
import { LoadingState } from "../../components/ui/loading-state"
import { Select } from "../../components/ui/select"
import { Toast, type ToastMessage } from "../../components/ui/toast"
import { apiClient, type ApiRecord } from "../../lib/api-client"
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
  const isBranches = current === "branches"
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
          {isUsers ? <UsersManager query={users} onToast={setToast}/> :
          isBranches ? <BranchesManager onToast={setToast}/> :
          <div className="p-6">
            {currentRecords.length > 1 ? <div className="mb-5 flex flex-wrap gap-2">{currentRecords.map((item) => <span key={item.id} className="rounded-lg bg-[#eef8fe] px-3 py-2 text-xs font-bold text-[#007DCC]">{String(item.data.name ?? item.data.code ?? item.id)}</span>)}</div> : null}
            <div className="grid gap-4 md:grid-cols-2">{definition.fields.map(([name, label]) => <label key={name}><span className="mb-1.5 block text-xs font-bold text-[#526874]">{label}</span>{["accountingBasis", "functionalCurrency"].includes(name) ? <Select value={values[name] ?? ""} onValueChange={(value) => setValues((old) => ({ ...old, [name]: value }))} options={name === "accountingBasis" ? ["accrual", "cash"] : ["USD", "SOS", "EUR"]}/> : <input value={values[name] ?? ""} onChange={(event) => setValues((old) => ({ ...old, [name]: event.target.value }))} className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC]"/>}</label>)}</div>
            <div className="mt-6 flex justify-end"><button onClick={() => void save()} disabled={mutations.create.isPending || mutations.update.isPending} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-5 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60">{mutations.create.isPending || mutations.update.isPending ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/>} {mutations.create.isPending || mutations.update.isPending ? "Updating…" : "Update settings"}</button></div>
          </div>}
        </Card>
      </div>
      <Toast message={toast} onClose={() => setToast(null)}/>
    </div>
  </AppShell>
}

type UserRow = {
  id: string
  email: string
  displayName: string
  role: string
  active: boolean
}

const roles = [
  "administrator",
  "finance_manager",
  "accountant",
  "sales",
  "purchasing",
  "warehouse",
  "payroll",
  "viewer",
]

function SettingsModal({
  title,
  description,
  children,
  saving,
  saveLabel,
  onClose,
  onSubmit,
}: {
  title: string
  description: string
  children: React.ReactNode
  saving: boolean
  saveLabel: string
  onClose: () => void
  onSubmit: () => void
}) {
  return <div onMouseDown={onClose} className="fixed inset-0 z-[130] grid place-items-center bg-[#071f33]/45 p-4 backdrop-blur-sm">
    <form onSubmit={(event) => { event.preventDefault(); onSubmit() }} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_28px_90px_rgba(7,31,51,0.3)]">
      <div className="flex items-start justify-between border-b border-[#e7edf1] px-5 py-4">
        <div><h3 className="text-base font-semibold text-[#203946]">{title}</h3><p className="mt-1 text-xs text-[#788b96]">{description}</p></div>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-[#71848f] hover:bg-[#f1f5f7]"><X size={17}/></button>
      </div>
      <div className="grid gap-4 p-5">{children}</div>
      <div className="flex justify-end gap-2 border-t border-[#e7edf1] bg-[#fbfcfd] px-5 py-4">
        <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[#dce6ed] px-4 text-xs font-semibold text-[#526874]">Cancel</button>
        <button disabled={saving} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-5 text-xs font-semibold text-white disabled:cursor-wait disabled:opacity-60">{saving ? <LoaderCircle size={15} className="animate-spin"/> : <Save size={15}/>} {saving ? "Saving…" : saveLabel}</button>
      </div>
    </form>
  </div>
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-xs font-semibold text-[#526874]">{label}{required ? <b className="ml-1 text-red-500">*</b> : null}</span>{children}</label>
}

const inputClass = "h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"

function BranchesManager({ onToast }: { onToast: (toast: ToastMessage) => void }) {
  const query = useResourceList("setup", "branches", { page: 1, pageSize: 100 })
  const mutations = useResourceMutations("setup", "branches")
  const [editing, setEditing] = useState<ApiRecord | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [address, setAddress] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<ApiRecord | null>(null)
  const open = (record?: ApiRecord) => {
    setEditing(record ?? null)
    setName(String(record?.data.name ?? ""))
    setCode(String(record?.data.code ?? ""))
    setAddress(String(record?.data.address ?? ""))
    setModalOpen(true)
  }
  const submit = async () => {
    try {
      const data = { name: name.trim(), code: code.trim().toUpperCase(), address: address.trim() }
      if (editing) await mutations.update.mutateAsync({ id: editing.id, version: editing.version, data })
      else await mutations.create.mutateAsync({ data, status: "active" })
      setModalOpen(false)
      onToast({ title: editing ? "Branch updated" : "Branch added", description: "Branch information was saved to PostgreSQL.", variant: "success" })
    } catch (error) {
      onToast({ title: "Branch not saved", description: error instanceof Error ? error.message : "Unable to save branch.", variant: "error" })
    }
  }
  if (query.isLoading) return <div className="p-6"><LoadingState label="Loading branches…"/></div>
  const rows = query.data?.data ?? []
  return <div>
    <div className="flex items-center justify-between border-b border-[#edf1f4] px-6 py-4"><p className="text-xs text-[#71848f]">{rows.length} operating branches</p><button onClick={() => open()} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-semibold text-white"><Plus size={15}/>Add branch</button></div>
    <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-[#f7f9fa] text-[10px] uppercase tracking-wide text-[#71848f]"><tr><th className="px-6 py-3">Branch</th><th className="px-4 py-3">Code</th><th className="px-4 py-3">Address</th><th className="px-4 py-3">Status</th><th className="px-6 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[#edf1f4]">{rows.map((row) => <tr key={row.id} className="text-xs text-[#405762]"><td className="px-6 py-4 font-semibold text-[#203946]">{String(row.data.name ?? "Unnamed")}</td><td className="px-4 py-4">{String(row.data.code ?? "—")}</td><td className="px-4 py-4">{String(row.data.address ?? "—")}</td><td className="px-4 py-4"><span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">Active</span></td><td className="px-6 py-4"><div className="flex justify-end gap-1"><button aria-label="Edit branch" onClick={() => open(row)} className="rounded-lg p-2 text-[#007DCC] hover:bg-[#eef8fe]"><Pencil size={15}/></button><button aria-label="Delete branch" onClick={() => setDeleteTarget(row)} className="rounded-lg p-2 text-red-500 hover:bg-red-50"><Trash2 size={15}/></button></div></td></tr>)}</tbody></table>{rows.length === 0 ? <div className="p-10 text-center text-sm text-[#71848f]">No branches added yet.</div> : null}</div>
    {modalOpen ? <SettingsModal title={editing ? "Edit branch" : "Add branch"} description="Create an operating location for BLUE PLASTIC CENTER." saving={mutations.create.isPending || mutations.update.isPending} saveLabel={editing ? "Update branch" : "Add branch"} onClose={() => setModalOpen(false)} onSubmit={() => void submit()}><Field label="Branch name" required><input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass}/></Field><Field label="Branch code" required><input required value={code} onChange={(e) => setCode(e.target.value)} className={inputClass}/></Field><Field label="Address"><input value={address} onChange={(e) => setAddress(e.target.value)} className={inputClass}/></Field></SettingsModal> : null}
    <ConfirmDeleteDialog open={Boolean(deleteTarget)} title="Move branch to Trash?" recordName={String(deleteTarget?.data.name ?? "")} description="The branch will be hidden but remains recoverable from Trash." onClose={() => setDeleteTarget(null)} onConfirm={() => { if (!deleteTarget) return; void mutations.remove.mutateAsync(deleteTarget.id).then(() => onToast({ title: "Branch moved to Trash", variant: "success" })).catch((error) => onToast({ title: "Branch not removed", description: error instanceof Error ? error.message : "Unable to remove branch.", variant: "error" })); setDeleteTarget(null) }}/>
  </div>
}

function UsersManager({ query, onToast }: { query: ReturnType<typeof useQuery<{ data: UserRow[] }>>; onToast: (toast: ToastMessage) => void }) {
  const client = useQueryClient()
  const users = query.data?.data ?? []
  const [modal, setModal] = useState<"user" | "password" | null>(null)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [role, setRole] = useState("viewer")
  const [password, setPassword] = useState("")
  const [deactivateTarget, setDeactivateTarget] = useState<UserRow | null>(null)
  const openUser = (user?: UserRow) => { setEditing(user ?? null); setDisplayName(user?.displayName ?? ""); setEmail(user?.email ?? ""); setRole(user?.role ?? "viewer"); setPassword(""); setModal("user") }
  const refresh = () => client.invalidateQueries({ queryKey: ["auth", "users"] })
  const saveUser = useMutation({
    mutationFn: () => editing
      ? apiClient.action<UserRow>(`/v1/auth/users/${editing.id}`, { displayName, email, role }, "PATCH")
      : apiClient.action<UserRow>("/v1/auth/users", { displayName, email, role, password }),
    onSuccess: async () => { await refresh(); setModal(null); onToast({ title: editing ? "User updated" : "User added", description: "The account is ready in the database.", variant: "success" }) },
    onError: (error) => onToast({ title: "User not saved", description: error instanceof Error ? error.message : "Unable to save user.", variant: "error" }),
  })
  const userAction = useMutation({
    mutationFn: ({ id, body, path = "" }: { id: string; body: Record<string, unknown>; path?: string }) =>
      apiClient.action(`/v1/auth/users/${id}${path}`, body, path ? "POST" : "PATCH"),
    onSuccess: async () => { await refresh(); onToast({ title: "User account updated", variant: "success" }) },
    onError: (error) => onToast({ title: "Action failed", description: error instanceof Error ? error.message : "Unable to update user.", variant: "error" }),
  })
  if (query.isLoading) return <div className="p-6"><LoadingState label="Loading users…"/></div>
  return <div>
    <div className="flex items-center justify-between border-b border-[#edf1f4] px-6 py-4"><p className="text-xs text-[#71848f]">{users.length} system users</p><button onClick={() => openUser()} className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-4 text-xs font-semibold text-white"><Plus size={15}/>Add user</button></div>
    <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-[#f7f9fa] text-[10px] uppercase tracking-wide text-[#71848f]"><tr><th className="px-6 py-3">User</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Status</th><th className="px-6 py-3 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[#edf1f4]">{users.map((user) => <tr key={user.id} className="text-xs text-[#405762]"><td className="px-6 py-4"><p className="font-semibold text-[#203946]">{user.displayName}</p><p className="mt-1 text-[#71848f]">{user.email}</p></td><td className="px-4 py-4 capitalize">{user.role.replaceAll("_", " ")}</td><td className="px-4 py-4"><span className={cn("rounded-full px-2.5 py-1 font-semibold", user.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}>{user.active ? "Active" : "Disabled"}</span></td><td className="px-6 py-4"><div className="flex justify-end gap-1"><button title="Edit user" onClick={() => openUser(user)} className="rounded-lg p-2 text-[#007DCC] hover:bg-[#eef8fe]"><Pencil size={15}/></button><button title="Reset password" onClick={() => { setEditing(user); setPassword(""); setModal("password") }} className="rounded-lg p-2 text-amber-600 hover:bg-amber-50"><KeyRound size={15}/></button><button disabled={userAction.isPending} title={user.active ? "Disable user" : "Activate user"} onClick={() => user.active ? setDeactivateTarget(user) : userAction.mutate({ id: user.id, body: { active: true } })} className={cn("rounded-lg p-2", user.active ? "text-red-500 hover:bg-red-50" : "text-emerald-600 hover:bg-emerald-50")}>{userAction.isPending ? <LoaderCircle size={15} className="animate-spin"/> : user.active ? <Trash2 size={15}/> : <ShieldCheck size={15}/>}</button></div></td></tr>)}</tbody></table></div>
    {modal === "user" ? <SettingsModal title={editing ? "Edit user" : "Add user"} description="Assign access appropriate to this employee's responsibilities." saving={saveUser.isPending} saveLabel={editing ? "Update user" : "Add user"} onClose={() => setModal(null)} onSubmit={() => saveUser.mutate()}><Field label="Display name" required><input required minLength={2} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputClass}/></Field><Field label="Email" required><input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass}/></Field><Field label="Role" required><Select value={role} onValueChange={setRole} options={roles}/></Field>{!editing ? <Field label="Temporary password" required><input required type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass}/></Field> : null}</SettingsModal> : null}
    {modal === "password" && editing ? <SettingsModal title="Reset password" description={`Set a temporary password for ${editing.displayName}. Existing sessions will be closed.`} saving={userAction.isPending} saveLabel="Reset password" onClose={() => setModal(null)} onSubmit={() => userAction.mutate({ id: editing.id, body: { password }, path: "/reset-password" }, { onSuccess: () => setModal(null) })}><Field label="New temporary password" required><input autoFocus required type="password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass}/></Field></SettingsModal> : null}
    <ConfirmDeleteDialog open={Boolean(deactivateTarget)} title="Disable this user?" recordName={deactivateTarget?.displayName} description="The user remains in the database but will no longer be able to sign in. You can reactivate the account later." confirmLabel="Disable user" onClose={() => setDeactivateTarget(null)} onConfirm={() => { if (!deactivateTarget) return; userAction.mutate({ id: deactivateTarget.id, body: { active: false } }); setDeactivateTarget(null) }}/>
  </div>
}
