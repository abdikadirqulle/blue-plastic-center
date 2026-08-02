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

/**
 * Account *reference* fields (incomeAccountId, receivableAccountId…).
 * Excludes chart meta fields and optional parent/subaccount links that must
 * stay blank unless the user picks them.
 */
export function isAccountReferenceField(fieldName: string) {
  if (/^(accountNumber|accountName|accountType|parentId|subaccountOf)$/i.test(fieldName))
    return false
  return /account/i.test(fieldName)
}

/**
 * Fields that should load the chart-of-accounts dropdown (includes optional
 * parent/subaccount pickers).
 */
export function isAccountLookupField(fieldName: string) {
  if (/^(accountNumber|accountName|accountType)$/i.test(fieldName)) return false
  return /account|parentId|subaccountOf/i.test(fieldName)
}

/**
 * Lookups the MVP forms can offer. Projects and employees are deferred, so no
 * screen asks for them and no request is made for them.
 */
const sources: ReferenceSource[] = [
  { module: "sales", resource: "customers", pattern: /customer/i },
  { module: "purchasing", resource: "vendors", pattern: /vendor|payee/i },
  { module: "inventory", resource: "items", pattern: /item|product|service/i },
  { module: "inventory", resource: "warehouses", pattern: /warehouse/i },
  {
    module: "accounting",
    resource: "chart-of-accounts",
    // Matched via isAccountReferenceField, not this pattern alone.
    pattern: /account|parentId|subaccountOf/i,
  },
]

export function useReferenceData() {
  const queryClient = useQueryClient()
  const customers = useResourceList("sales", "customers", { page: 1, pageSize: 100 })
  const vendors = useResourceList("purchasing", "vendors", { page: 1, pageSize: 100 })
  const items = useResourceList("inventory", "items", { page: 1, pageSize: 100 })
  const warehouses = useResourceList("inventory", "warehouses", { page: 1, pageSize: 100 })
  const accounts = useResourceList("accounting", "chart-of-accounts", { page: 1, pageSize: 100 })
  // Multi-currency is deferred, so every document is written in the company's
  // functional currency rather than one chosen on the form.
  const company = useResourceList("setup", "company-settings", { page: 1, pageSize: 1 })

  const queries = [customers, vendors, items, warehouses, accounts]

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
      sources.find((source) => {
        if (source.resource === "chart-of-accounts")
          return isAccountLookupField(fieldName)
        return source.pattern.test(fieldName)
      })

    const accountRecords = accounts.data?.data ?? []
    const itemRecords = items.data?.data ?? []
    /**
     * Every account select shows the full chart. The user picks the right
     * account for the field — the form must not hide income from a COGS
     * picker, or expenses from an income picker.
     */
    const accountOptionsFor = (_fieldName: string) =>
      accountRecords.map((record) => ({
        value: record.id,
        label: `${recordIdentifier(record)} — ${recordTitle(record)}`,
      }))

    return {
      baseCurrency: String(
        company.data?.data[0]?.data.functionalCurrency ?? "USD",
      ),
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
    company.data,
    queryClient,
  ])
}
