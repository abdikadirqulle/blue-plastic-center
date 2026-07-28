import type { FinancialLine } from "./financial-report-model"
import { money } from "./financial-report-model"
import { cn } from "../../lib/utils"

export function FinancialReportTable({ lines }: { lines: FinancialLine[] }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  let currentSection = ""
  return (
    <div className="mx-auto max-w-[900px] px-5 py-6">
      <table className="w-full text-[13px]">
        <thead><tr className="border-b-2 border-[#526873] text-[#526873]"><th className="px-3 py-2 text-left font-semibold">Account</th><th className="px-3 py-2 text-right font-semibold">Total</th></tr></thead>
        <tbody>
          {lines.map((line, index) => {
            if (line.style === "section") currentSection = line.label
            const section = currentSection
            const hidden = line.style === "account" && collapsed.has(section)
            if (hidden) return null
            return (
            <tr key={`${line.label}-${index}`} className={cn(
              line.style === "account" && "border-b border-[#edf1f3]",
              line.style === "section" && "text-[#007DCC]",
              line.style === "subtotal" && "font-semibold",
              line.style === "total" && "border-y-2 border-[#526873] font-bold text-[#152e3a]",
            )}>
              <td className={cn("px-3", line.style === "section" ? "pb-1 pt-6 font-bold" : "py-2", line.level && "pl-8")}>
                {line.style === "section" ? (
                  <button className="inline-flex items-center gap-1.5" onClick={() => setCollapsed((current) => {
                    const next = new Set(current)
                    if (next.has(line.label)) next.delete(line.label)
                    else next.add(line.label)
                    return next
                  })}>
                    {collapsed.has(line.label) ? <ChevronRight size={15}/> : <ChevronDown size={15}/>}
                    {line.label}
                  </button>
                ) : line.label}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{line.amount === undefined ? "" : money(line.amount)}</td>
            </tr>
          )})}
        </tbody>
      </table>
    </div>
  )
}
import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
