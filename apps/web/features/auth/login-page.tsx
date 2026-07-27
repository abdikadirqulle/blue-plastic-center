"use client";

import { useState } from "react";
import { useRouter } from "../../components/routing";
import { CircleDollarSign, Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { z } from "zod";
import { Select } from "../../components/ui/select";

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState("BLUE PLASTIC CENTER");
  const [error, setError] = useState("");

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#071f33] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 size-[420px] rounded-full bg-[#007DCC]/25 blur-3xl" />
        <div className="absolute -bottom-48 -left-24 size-[520px] rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-[#007DCC]"><CircleDollarSign size={25}/></span>
          <div><p className="text-lg font-bold">BLUE PLASTIC CENTER</p><p className="text-xs text-[#9cb3c3]">Business system</p></div>
        </div>
        <div className="relative max-w-xl">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-300">One source of truth</p>
          <h1 className="mt-5 text-5xl font-bold leading-[1.08] tracking-[-0.05em]">Run your entire business with clarity.</h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#b8c9d5]">Accounting, sales, purchasing, inventory, banking, projects, payroll, and reporting—connected in one secure workspace.</p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {[["$842K","Assets"],["1,248","Items"],["96.8%","Reconciled"]].map(([value,label])=>(
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-xs text-[#98afbf]">{label}</p></div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-[#809aab]">© 2026 BLUE PLASTIC CENTER. Secure enterprise workspace.</p>
      </section>
      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="grid size-10 place-items-center rounded-xl bg-[#007DCC] text-white"><CircleDollarSign size={23}/></span>
            <p className="text-lg font-bold">BLUE PLASTIC CENTER</p>
          </div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#007DCC]">Welcome back</p>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[#15303f]">Sign in to your workspace</h2>
          <p className="mt-2 text-sm text-[#758995]">Use your company credentials to continue.</p>
          <form
            className="mt-8 space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              const values = Object.fromEntries(new FormData(event.currentTarget));
              const result = z.object({
                email: z.string().email("Enter a valid email address"),
                password: z.string().min(6, "Password must contain at least 6 characters"),
              }).safeParse(values);
              if (!result.success) { setError(result.error.issues[0]?.message ?? "Check your sign-in details"); return; }
              setError("");
              setLoading(true);
              window.setTimeout(() => router.push("/"), 650);
            }}
          >
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#455e6b]">Company</span><Select name="company" value={company} onValueChange={setCompany} options={["BLUE PLASTIC CENTER","Blue Plastic Logistics","Blue Plastic Retail"]} className="h-12"/></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-[#455e6b]">Email address</span><div className="relative"><Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7f929d]" size={17}/><input name="email" type="email" defaultValue="admin@blueplastic.so" className="h-12 w-full rounded-xl border border-[#dce6ed] pl-10 pr-3 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"/></div></label>
            <label className="block"><div className="mb-1.5 flex justify-between"><span className="text-xs font-bold text-[#455e6b]">Password</span><button type="button" onClick={()=>window.alert("A password reset link would be sent by the backend.")} className="text-xs font-bold text-[#007DCC]">Forgot password?</button></div><div className="relative"><LockKeyhole className="absolute left-3 top-1/2 -translate-y-1/2 text-[#7f929d]" size={17}/><input name="password" type={showPassword?"text":"password"} defaultValue="blueplastic2026" className="h-12 w-full rounded-xl border border-[#dce6ed] pl-10 pr-11 text-sm outline-none focus:border-[#007DCC] focus:ring-4 focus:ring-[#007DCC]/10"/><button type="button" aria-label={showPassword?"Hide password":"Show password"} onClick={()=>setShowPassword(value=>!value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6f8490]">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
            {error ? <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p> : null}
            <label className="flex items-center gap-2 text-xs font-medium text-[#607681]"><input type="checkbox" defaultChecked className="size-4 accent-[#007DCC]"/> Keep me signed in on this device</label>
            <button disabled={loading} type="submit" className="h-12 w-full rounded-xl bg-[#007DCC] text-sm font-bold text-white shadow-lg shadow-sky-900/10 hover:bg-[#0069ad] disabled:opacity-70">{loading?"Signing in…":"Sign in securely"}</button>
          </form>
          <p className="mt-6 text-center text-xs leading-5 text-[#83949e]">Protected by role-based access, audit logging, and encrypted sessions.</p>
        </div>
      </section>
    </main>
  );
}
