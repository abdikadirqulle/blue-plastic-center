"use client"

import { useState } from "react"
import {
  Building2,
  Camera,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import { AppShell } from "../../components/layout/app-shell"
import { Card } from "../../components/ui/card"
import { Select } from "../../components/ui/select"
import { Toast, type ToastMessage } from "../../components/ui/toast"

export default function ProfilePage() {
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [language, setLanguage] = useState("English")
  const [timezone, setTimezone] = useState("Africa/Mogadishu")
  const save = () => {
    setToast({
      title: "Profile updated",
      description: "Your personal details and preferences were saved.",
      variant: "success",
    })
    window.setTimeout(() => setToast(null), 3200)
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl">
        <div>
          <p className="text-xs font-bold text-[#007DCC]">Personal account</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.035em] text-[#142735] md:text-[29px]">
            My profile
          </h1>
          <p className="mt-1.5 text-sm text-[#6b7e8a]">
            Manage your identity, preferences, and account security.
          </p>
        </div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="p-5 text-center">
              <div className="relative mx-auto w-fit">
                <span className="grid size-24 place-items-center rounded-3xl bg-[#dcefff] text-2xl font-bold text-[#0063a3]">
                  AK
                </span>
                <button
                  aria-label="Change profile photo"
                  onClick={() =>
                    setToast({
                      title: "Photo selector ready",
                      description:
                        "Image upload will connect to account storage.",
                      variant: "info",
                    })
                  }
                  className="absolute -bottom-2 -right-2 grid size-9 place-items-center rounded-xl border-4 border-white bg-[#007DCC] text-white"
                >
                  <Camera size={15} />
                </button>
              </div>
              <h2 className="mt-5 text-base font-bold text-[#263f4b]">
                Abdisalam Abdulahi
              </h2>
              <p className="mt-1 text-xs text-[#71848f]">Administrator</p>
              <div className="mt-5 space-y-2 border-t border-[#edf1f4] pt-4 text-left text-xs text-[#526874]">
                <p className="flex items-center gap-2">
                  <Building2 size={14} /> BLUE PLASTIC CENTER
                </p>
                <p className="flex items-center gap-2">
                  <ShieldCheck size={14} /> Full system access
                </p>
                <p className="flex items-center gap-2">
                  <MapPin size={14} /> Main company
                </p>
              </div>
            </Card>
            <Card className="p-4">
              <h3 className="text-xs font-bold text-[#304853]">
                Account security
              </h3>
              <div className="mt-3 flex items-center gap-3 rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                <ShieldCheck size={17} /> Two-factor enabled
              </div>
              <button
                onClick={() =>
                  setToast({
                    title: "Security settings opened",
                    description: "Password and two-factor controls are ready.",
                    variant: "info",
                  })
                }
                className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-[#405762] hover:bg-[#f5f8fa]"
              >
                <KeyRound size={15} /> Change security settings
              </button>
            </Card>
          </div>
          <div className="space-y-4">
            <Card className="overflow-hidden">
              <div className="border-b border-[#edf1f4] px-5 py-4">
                <h2 className="text-sm font-bold text-[#263f4b]">
                  Personal information
                </h2>
                <p className="mt-1 text-xs text-[#82949e]">
                  Used for approvals, audit history, and communication.
                </p>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <label className="text-xs font-bold text-[#405762]">
                  <span className="mb-2 flex items-center gap-2">
                    <UserRound size={14} /> First name
                  </span>
                  <input
                    defaultValue="Abdisalam"
                    className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"
                  />
                </label>
                <label className="text-xs font-bold text-[#405762]">
                  <span className="mb-2 block">Last name</span>
                  <input
                    defaultValue="Abdullahi"
                    className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"
                  />
                </label>
                <label className="text-xs font-bold text-[#405762]">
                  <span className="mb-2 flex items-center gap-2">
                    <Mail size={14} /> Email
                  </span>
                  <input
                    type="email"
                    defaultValue="abdisalam@blueplastic.example"
                    className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"
                  />
                </label>
                <label className="text-xs font-bold text-[#405762]">
                  <span className="mb-2 flex items-center gap-2">
                    <Phone size={14} /> Phone
                  </span>
                  <input
                    defaultValue="+252 61 555 0100"
                    className="h-11 w-full rounded-xl border border-[#dce6ed] px-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"
                  />
                </label>
              </div>
            </Card>
            <Card className="overflow-hidden">
              <div className="border-b border-[#edf1f4] px-5 py-4">
                <h2 className="text-sm font-bold text-[#263f4b]">
                  Workspace preferences
                </h2>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <label className="text-xs font-bold text-[#405762]">
                  <span className="mb-2 block">Language</span>
                  <Select
                    value={language}
                    onValueChange={setLanguage}
                    options={["English", "Somali", "Arabic"]}
                  />
                </label>
                <label className="text-xs font-bold text-[#405762]">
                  <span className="mb-2 block">Timezone</span>
                  <Select
                    value={timezone}
                    onValueChange={setTimezone}
                    options={[
                      "Africa/Mogadishu",
                      "Africa/Nairobi",
                      "Asia/Dubai",
                      "UTC",
                    ]}
                  />
                </label>
              </div>
              <div className="flex justify-end border-t border-[#edf1f4] px-5 py-4">
                <button
                  onClick={save}
                  className="rounded-xl bg-[#007DCC] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0069ad]"
                >
                  Save profile
                </button>
              </div>
            </Card>
          </div>
        </div>
        <Toast message={toast} onClose={() => setToast(null)} />
      </div>
    </AppShell>
  )
}
