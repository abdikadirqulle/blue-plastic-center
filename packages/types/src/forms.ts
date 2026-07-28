import { z } from "zod"

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "checkbox"

export interface FormField {
  name: string
  label: string
  type: FieldType
  required?: boolean
  options?: string[]
  placeholder?: string
  width?: "half" | "third" | "full"
}

export interface FormSection {
  title: string
  description?: string
  fields: FormField[]
}

export interface ResourceRow {
  id: string
  displayId?: string
  cells: string[]
  status: string
}

export interface ResourceConfig {
  module: string
  moduleTitle: string
  slug: string
  title: string
  description: string
  primaryAction: string
  searchPlaceholder: string
  columns: string[]
  stats: Array<{ label: string; value: string; helper: string }>
  formSections: FormSection[]
  hasLineItems?: boolean
  rows: ResourceRow[]
  presentation?: "table" | "cards" | "sections"
}

export interface ModuleDefinition {
  title: string
  description: string
  resources: Array<{ slug: string; label: string }>
}

export function essentialFormFields(fields: FormField[]) {
  const configured = fields.filter((field) => field.required)
  const selected: FormField[] = []
  const byName = new Map(configured.map((field) => [field.name, field]))
  if (byName.has("employeeId")) {
    for (const name of ["employeeId", "firstName", "lastName"]) {
      const field = byName.get(name)
      if (field) selected.push(field)
    }
  }
  const take = (pattern: RegExp) => {
    const field = configured.find(
      (candidate) =>
        pattern.test(candidate.name) && !selected.includes(candidate),
    )
    if (field) selected.push(field)
  }
  take(
    /^(customer|customerId|customerName|vendor|vendorId|vendorName|employee|employeeId|account|accountId|accountName|item|itemId|itemName|project|projectId|projectName|payee|displayName|name)$/i,
  )
  take(
    /(transactionDate|invoiceDate|billDate|paymentDate|receiptDate|orderDate|entryDate|payDate|startDate|date)$/i,
  )
  take(/^(amount|total|openingBalance|contractAmount|grossPay|quantity)$/i)
  take(/^(dueDate)$/i)
  if (!selected.length && configured[0]) selected.push(configured[0])
  return new Set(selected.slice(0, 4).map((field) => field.name))
}

export function createDraftFormSchema(fields: FormField[]) {
  const required = essentialFormFields(fields)
  return z.object(
    Object.fromEntries(
      fields.map((field) => {
        let validator: z.ZodTypeAny = required.has(field.name)
          ? z.string().min(1, `${field.label} is required`)
          : z.string()
        if (field.type === "email")
          validator = required.has(field.name)
            ? z.string().email("Enter a valid email address")
            : z.union([
                z.literal(""),
                z.string().email("Enter a valid email address"),
              ])
        return [field.name, validator]
      }),
    ),
  )
}
