import { useMemo } from "react"
import type { FormField } from "@blue-plastic/types"
import type { SelectOption } from "../../components/ui/select"
import { recordIdentifier, recordTitle, useResourceList } from "./resource-api"

interface ReferenceSource {
  module: string
  resource: string
  pattern: RegExp
}

const sources: ReferenceSource[] = [
  { module: "sales", resource: "customers", pattern: /customer/i },
  { module: "purchasing", resource: "vendors", pattern: /vendor|payee/i },
  { module: "inventory", resource: "items", pattern: /item|product|service/i },
  { module: "inventory", resource: "warehouses", pattern: /warehouse/i },
  { module: "accounting", resource: "chart-of-accounts", pattern: /account/i },
  { module: "projects", resource: "projects", pattern: /project/i },
  { module: "payroll", resource: "employees", pattern: /employee/i },
]

export function useReferenceData() {
  const customers = useResourceList("sales", "customers", { page: 1, pageSize: 100 })
  const vendors = useResourceList("purchasing", "vendors", { page: 1, pageSize: 100 })
  const items = useResourceList("inventory", "items", { page: 1, pageSize: 100 })
  const warehouses = useResourceList("inventory", "warehouses", { page: 1, pageSize: 100 })
  const accounts = useResourceList("accounting", "chart-of-accounts", { page: 1, pageSize: 100 })
  const projects = useResourceList("projects", "projects", { page: 1, pageSize: 100 })
  const employees = useResourceList("payroll", "employees", { page: 1, pageSize: 100 })

  const queries = [customers, vendors, items, warehouses, accounts, projects, employees]

  return useMemo(() => {
    const bySource = new Map<string, SelectOption[]>()
    const labels = new Map<string, string>()

    sources.forEach((source, index) => {
      const options = (queries[index].data?.data ?? []).map((record) => {
        const title = recordTitle(record)
        const identifier = recordIdentifier(record)
        const label = identifier !== title ? `${identifier} — ${title}` : title
        labels.set(record.id, label)
        return { value: record.id, label }
      })
      bySource.set(`${source.module}/${source.resource}`, options)
    })

    const sourceFor = (fieldName: string) =>
      sources.find((source) => source.pattern.test(fieldName))

    return {
      itemOptions: bySource.get("inventory/items") ?? [],
      accountOptions: bySource.get("accounting/chart-of-accounts") ?? [],
      optionsFor(field: FormField): SelectOption[] | undefined {
        const source = sourceFor(field.name)
        return source
          ? bySource.get(`${source.module}/${source.resource}`)
          : undefined
      },
      resolve(value: unknown) {
        if (value === undefined || value === null || value === "") return "—"
        return labels.get(String(value)) ?? String(value)
      },
    }
  }, [
    customers.data,
    vendors.data,
    items.data,
    warehouses.data,
    accounts.data,
    projects.data,
    employees.data,
  ])
}
