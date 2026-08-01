/**
 * Single definition of what the MVP ships.
 *
 * Nothing here deletes code. Modules, resources and fields outside this scope
 * still exist in the catalog, the contracts and the database; they are simply
 * not reachable from the UI or the API until they are added back to these
 * lists. Both applications read this file so the frontend cannot offer a
 * workflow the backend refuses, or the other way round.
 */

/** Allowed resources per module. A module absent from this map is hidden. */
export const mvpScope: Readonly<Record<string, readonly string[]>> = {
  sales: ["customers", "invoices", "sales-receipts", "payments"],
  purchasing: ["vendors", "bills", "bill-payments", "expenses"],
  // Stock levels back the inventory valuation report and warehouses back the
  // location an invoice line releases stock from. Neither is a screen.
  inventory: ["items", "stock-levels", "warehouses"],
  accounting: ["chart-of-accounts", "journal-entries"],
  reports: ["financial", "sales", "purchasing"],
  // Not navigable. The receivable and payable subledgers stay reachable on the
  // server because A/R and A/P aging and control-account reconciliation read
  // them; once aging is derived from invoices and bills this can close too.
  debts: ["receivables", "payables"],
  // Company configuration the MVP screens depend on. Currencies, memorized
  // reports and workflow builders stay out until multi-currency returns.
  setup: [
    "company-settings",
    "branches",
    "payment-terms",
    "document-sequences",
    "opening-balances",
    "notifications",
  ],
  settings: [
    "company",
    "branches",
    "users-roles",
    "accounting-controls",
    "security",
  ],
  // Attachment, email and PDF delivery for MVP documents. Not a navigable
  // module; it backs the send and print actions on invoices and bills.
  documents: ["attachments", "email-jobs", "pdf-jobs"],
}

/** In scope for the API, but never a destination in the interface. */
export const backendOnlyModules: ReadonlySet<string> = new Set([
  "debts",
  "documents",
  "setup",
])

/** Same idea for single resources that only exist to feed a report. */
export const backendOnlyResources: ReadonlySet<string> = new Set([
  "inventory/stock-levels",
  "inventory/warehouses",
])

export function isMvpModule(moduleName: string) {
  return Object.hasOwn(mvpScope, moduleName)
}

export function isNavigableModule(moduleName: string) {
  return isMvpModule(moduleName) && !backendOnlyModules.has(moduleName)
}

export function isNavigableResource(moduleName: string, resourceName: string) {
  return (
    isNavigableModule(moduleName) &&
    isMvpResource(moduleName, resourceName) &&
    !backendOnlyResources.has(`${moduleName}/${resourceName}`)
  )
}

export function isMvpResource(moduleName: string, resourceName: string) {
  return Boolean(mvpScope[moduleName]?.includes(resourceName))
}

/**
 * Capabilities parked until after the MVP. Each entry matches field names and
 * labels, so a form field is dropped whether it is called `taxCode` or
 * "Sales tax code".
 */
export const deferredCapabilities = {
  tax: /tax|vat|withholding/i,
  interest: /interest|finance charge|surcharge|late fee/i,
  shipping: /^ship|shipping|freight|carrier|tracking number|delivery method/i,
  classes: /^class([A-Z_]|$)|\bclass(es)?\b|department|segment/i,
  locations: /location|warehouse|\bsite\b|\bbin\b/i,
  multiCurrency:
    /^currency$|^currencyName$|exchange ?rate|base currency|functional currency|currency name/i,
  recurring: /recurring|frequency|schedule|template ?name|next run/i,
  advancedDiscounts:
    /^discount(Type|Value|Account|Date)$|discount (type|value|account|date)|early payment/i,
} as const

export type DeferredCapability = keyof typeof deferredCapabilities

/** Fields the MVP forms keep even though a deferred pattern would match them. */
const retainedFieldNames = new Set([
  // A single per-line discount amount stays; only document-level and
  // early-payment discount schemes are deferred.
  "discountAmount",
  // Inventory posting still needs the location stock leaves from.
  "warehouse",
  "warehouseId",
])

/**
 * Returns the capability that defers a field, or undefined when the field is
 * part of the MVP. `label` is optional so backend callers can pass a name only.
 */
export function deferredCapabilityOf(
  name: string,
  label = "",
): DeferredCapability | undefined {
  if (retainedFieldNames.has(name)) return undefined
  for (const [capability, pattern] of Object.entries(deferredCapabilities)) {
    if (pattern.test(name) || (label && pattern.test(label)))
      return capability as DeferredCapability
  }
  return undefined
}

export function isDeferredField(name: string, label = "") {
  return deferredCapabilityOf(name, label) !== undefined
}
