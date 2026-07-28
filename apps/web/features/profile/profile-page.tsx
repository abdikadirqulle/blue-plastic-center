"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  Building2,
  LoaderCircle,
  Mail,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { AppShell } from "../../components/layout/app-shell"
import { Card } from "../../components/ui/card"
import { Skeleton } from "../../components/ui/skeleton"
import { Toast, type ToastMessage } from "../../components/ui/toast"
import { apiClient } from "../../lib/api-client"

type ProfileUser = {
  id?: string
  userId?: string
  displayName?: string
  name?: string
  email?: string
  role: string
}

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const profile = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiClient.getPath<{ user: ProfileUser }>("/v1/auth/me"),
  })
  const user = profile.data?.data.user

  useEffect(() => {
    if (!user) return
    setDisplayName(user.displayName ?? user.name ?? "")
    setEmail(user.email ?? "")
  }, [user])

  const initials = useMemo(
    () =>
      (displayName || user?.name || "BP")
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase(),
    [displayName, user?.name],
  )

  const update = useMutation({
    mutationFn: () =>
      apiClient.action<{ user: ProfileUser }>(
        "/v1/auth/me",
        { displayName: displayName.trim(), email: email.trim() },
        "PATCH",
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] })
      setToast({
        title: "Profile updated",
        description: "Your account information was saved to the database.",
        variant: "success",
      })
    },
    onError: (error) =>
      setToast({
        title: "Profile not updated",
        description: error instanceof Error ? error.message : "Unable to update profile.",
        variant: "error",
      }),
  })

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-semibold text-[#007DCC]">Personal account</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#142735]">My profile</h1>
        <p className="mt-1.5 text-sm text-[#6b7e8a]">
          Manage the identity used for approvals, audit history, and sign-in.
        </p>

        {profile.isLoading ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]" role="status" aria-label="Loading profile">
            <Card className="space-y-4 p-5"><Skeleton className="mx-auto size-20 rounded-full"/><Skeleton className="mx-auto h-4 w-36"/><Skeleton className="mx-auto h-3 w-24"/><Skeleton className="h-20 w-full"/></Card>
            <Card className="space-y-5 p-5"><h2 className="text-sm font-semibold text-[#263f4b]">Personal information</h2><div className="grid gap-4 sm:grid-cols-2"><div><p className="mb-2 text-xs text-[#405762]">Display name</p><Skeleton className="h-11 w-full"/></div><div><p className="mb-2 text-xs text-[#405762]">Email</p><Skeleton className="h-11 w-full"/></div></div></Card>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <Card className="h-fit p-5 text-center">
              <span className="mx-auto grid size-20 place-items-center rounded-full bg-[#dcefff] text-xl font-semibold text-[#0063a3]">
                {initials}
              </span>
              <h2 className="mt-4 text-base font-semibold text-[#263f4b]">
                {user?.displayName ?? user?.name}
              </h2>
              <p className="mt-1 text-xs capitalize text-[#71848f]">
                {user?.role?.replaceAll("_", " ")}
              </p>
              <div className="mt-5 space-y-3 border-t border-[#edf1f4] pt-4 text-left text-xs text-[#526874]">
                <p className="flex items-center gap-2">
                  <Building2 size={14} /> BLUE PLASTIC CENTER
                </p>
                <p className="flex items-center gap-2">
                  <ShieldCheck size={14} /> Secure database account
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b border-[#edf1f4] px-5 py-4">
                <h2 className="text-sm font-semibold text-[#263f4b]">
                  Personal information
                </h2>
                <p className="mt-1 text-xs text-[#82949e]">
                  Changes take effect across the application after saving.
                </p>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault()
                  update.mutate()
                }}
              >
                <div className="grid gap-4 p-5 sm:grid-cols-2">
                  <label className="text-xs font-semibold text-[#405762]">
                    <span className="mb-2 flex items-center gap-2">
                      <UserRound size={14} /> Display name <b className="text-red-500">*</b>
                    </span>
                    <input
                      required
                      minLength={2}
                      value={displayName}
                      onChange={(event) => setDisplayName(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"
                    />
                  </label>
                  <label className="text-xs font-semibold text-[#405762]">
                    <span className="mb-2 flex items-center gap-2">
                      <Mail size={14} /> Email <b className="text-red-500">*</b>
                    </span>
                    <input
                      required
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"
                    />
                  </label>
                </div>
                <div className="flex justify-end border-t border-[#edf1f4] px-5 py-4">
                  <button
                    disabled={update.isPending || !displayName.trim() || !email.trim()}
                    className="flex h-10 items-center gap-2 rounded-xl bg-[#007DCC] px-5 text-xs font-semibold text-white hover:bg-[#0069ad] disabled:cursor-wait disabled:opacity-60"
                  >
                    {update.isPending ? (
                      <LoaderCircle size={15} className="animate-spin" />
                    ) : (
                      <Save size={15} />
                    )}
                    {update.isPending ? "Updating…" : "Update profile"}
                  </button>
                </div>
              </form>
            </Card>
          </div>
        )}
        <Toast message={toast} onClose={() => setToast(null)} />
      </div>
    </AppShell>
  )
}
