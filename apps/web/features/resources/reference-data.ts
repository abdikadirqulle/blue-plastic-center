import { useMemo } from "react"
import { useQueryClient } from "@tanstack/react-query"
import type { FormField } from "@blue-plastic/types"
import type { QuickAddInput, SelectOption } from "../../components/ui/select"
import { apiClient } from "../../lib/api-client"
import { queryKeys } from "../../lib/query-client"
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
  const queryClient = useQueryClient()
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
        const label =
          source.resource === "items"
            ? title
            : identifier !== title
              ? `${identifier} — ${title}`
              : title
        labels.set(record.id, label)
        return { value: record.id, label }
      })
      bySource.set(`${source.module}/${source.resource}`, options)
    })

    const sourceFor = (fieldName: string) =>
      sources.find((source) => source.pattern.test(fieldName))

    const accountRecords = accounts.data?.data ?? []
    const itemRecords = items.data?.data ?? []
    const accountOptionsFor = (fieldName: string) => {
      const expectedType =
        /cogs|costOfGoods/i.test(fieldName)
          ? "cost-of-goods-sold"
          : /income/i.test(fieldName)
            ? "income"
            : /expense/i.test(fieldName)
              ? "expense"
              : /asset|inventory/i.test(fieldName)
                ? "asset"
                : undefined
      const records = expectedType
        ? accountRecords.filter((record) => record.data.accountType === expectedType)
        : accountRecords
      return records.map((record) => ({
        value: record.id,
        label: `${recordIdentifier(record)} — ${recordTitle(record)}`,
      }))
    }

    return {
      itemOptions: bySource.get("inventory/items") ?? [],
      accountOptions: bySource.get("accounting/chart-of-accounts") ?? [],
      itemById: new Map(itemRecords.map((record) => [record.id, record])),
      accountOptionsFor,
      optionsFor(field: FormField): SelectOption[] | undefined {
        const source = sourceFor(field.name)
        if (!source) return undefined
        return source.resource === "chart-of-accounts"
          ? accountOptionsFor(field.name)
          : bySource.get(`${source.module}/${source.resource}`)
      },
      async createOption(input: QuickAddInput) {
        if (input.kind === "item") {
          const response = await apiClient.create("inventory", "items", {
            name: input.name,
            sku: input.code,
            type: input.itemType,
            unit: input.unit,
            salesPrice: input.salesPrice || "0",
            purchaseCost: input.purchaseCost || "0",
          }, "active")
          await queryClient.invalidateQueries({
            queryKey: queryKeys.resource("inventory", "items"),
          })
          return {
            value: response.data.id,
            label: input.name,
          }
        }
        if (input.kind === "account") {
          const response = await apiClient.create("accounting", "chart-of-accounts", {
            accountNumber: input.code,
            accountName: input.name,
            accountType: input.accountType,
            currency: "USD",
          }, "active")
          await queryClient.invalidateQueries({
            queryKey: queryKeys.resource("accounting", "chart-of-accounts"),
          })
          return {
            value: response.data.id,
            label: `${input.code} — ${input.name}`,
          }
        }
        const moduleName = input.kind === "vendor" ? "purchasing" : "sales"
        const resourceName = input.kind === "vendor" ? "vendors" : "customers"
        const response = await apiClient.create(moduleName, resourceName, {
          displayName: input.name,
          ...(input.contact.includes("@")
            ? { email: input.contact }
            : input.contact ? { phone: input.contact } : {}),
          currency: "USD",
          openingBalance: "0",
        }, "active")
        await queryClient.invalidateQueries({
          queryKey: queryKeys.resource(moduleName, resourceName),
        })
        return { value: response.data.id, label: input.name }
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
    queryClient,
  ])
}
