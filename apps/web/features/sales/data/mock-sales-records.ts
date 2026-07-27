import type { SalesRecord, SalesResource } from "../domain/sales-record"

const customers = [
  "Banaadir Trading Co.",
  "Sahal Distributors",
  "Horn Logistics",
  "Dayax Retail",
  "Amaan Services",
]
const dates = [
  "2026-07-25",
  "2026-07-23",
  "2026-07-22",
  "2026-07-20",
  "2026-07-19",
]
const amounts = [
  "$8,420.00",
  "$6,250.00",
  "$3,180.00",
  "$12,760.00",
  "$2,940.00",
]

const presets: Record<
  SalesResource,
  { prefix: string; statuses: string[]; methods?: string[] }
> = {
  invoices: {
    prefix: "INV",
    statuses: ["Paid", "Overdue", "Pending", "Paid", "Draft"],
  },
  customers: {
    prefix: "CUS",
    statuses: ["Active", "Active", "Credit hold", "Active", "Inactive"],
  },
  estimates: {
    prefix: "EST",
    statuses: ["Accepted", "Open", "Expired", "Converted", "Draft"],
  },
  "sales-orders": {
    prefix: "SO",
    statuses: [
      "Ready to ship",
      "Backordered",
      "Open",
      "Partially fulfilled",
      "Closed",
    ],
  },
  payments: {
    prefix: "PAY",
    statuses: [
      "Applied",
      "Undeposited",
      "Partially applied",
      "Deposited",
      "Unapplied",
    ],
    methods: ["Bank transfer", "Cash", "Cheque", "EVC Plus", "Card"],
  },
  "credit-notes": {
    prefix: "CM",
    statuses: ["Applied", "Open", "Refunded", "Partially applied", "Draft"],
  },
  "sales-receipts": {
    prefix: "SR",
    statuses: ["Deposited", "Undeposited", "Deposited", "Voided", "Pending"],
    methods: ["Cash", "EVC Plus", "Card", "Cheque", "Bank transfer"],
  },
  "refund-receipts": {
    prefix: "RF",
    statuses: ["Paid", "Pending", "Paid", "Voided", "Approved"],
    methods: ["Cash", "EVC Plus", "Card", "Cheque", "Bank transfer"],
  },
  statements: {
    prefix: "STM",
    statuses: ["Sent", "Overdue", "Viewed", "Draft", "Sent"],
  },
  deposits: {
    prefix: "DEP",
    statuses: ["Reconciled", "Pending", "Cleared", "Pending", "Cleared"],
    methods: [
      "Salaam Bank",
      "Premier Bank",
      "Salaam Bank",
      "Cash on hand",
      "Dahabshiil Bank",
    ],
  },
  "recurring-invoices": {
    prefix: "REC",
    statuses: ["Active", "Paused", "Active", "Completed", "Draft"],
  },
}

export const mockSalesRecords = Object.fromEntries(
  Object.entries(presets).map(([resource, preset]) => [
    resource,
    customers.map(
      (customer, index): SalesRecord => ({
        id: `${preset.prefix}-${String(1048 - index).padStart(4, "0")}`,
        resource: resource as SalesResource,
        customer,
        amount: amounts[index],
        date: dates[index],
        status: preset.statuses[index],
        reference: index % 2 ? `REF-${6842 + index}` : `PO-${2401 + index}`,
        paymentMethod: preset.methods?.[index],
        balance: index === 0 ? "$0.00" : amounts[index],
        memo: `${customer} ${resource.replaceAll("-", " ")} transaction`,
      }),
    ),
  ]),
) as Record<SalesResource, SalesRecord[]>
