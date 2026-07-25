import type { ActivityItem, FinancialMetric } from "../../types/finance";

export const metrics: FinancialMetric[] = [
  {
    label: "Total revenue",
    value: 284650,
    change: 12.8,
    trend: "up",
    helper: "vs. previous period",
  },
  {
    label: "Net profit",
    value: 68420,
    change: 8.4,
    trend: "up",
    helper: "24.0% profit margin",
  },
  {
    label: "Receivables",
    value: 92750,
    change: 5.1,
    trend: "down",
    helper: "$18,240 overdue",
  },
  {
    label: "Cash on hand",
    value: 146380,
    change: 4.2,
    trend: "up",
    helper: "Across 6 accounts",
  },
];

export const cashFlow = [
  { month: "Jan", inflow: 78, outflow: 55 },
  { month: "Feb", inflow: 91, outflow: 62 },
  { month: "Mar", inflow: 83, outflow: 59 },
  { month: "Apr", inflow: 108, outflow: 67 },
  { month: "May", inflow: 115, outflow: 72 },
  { month: "Jun", inflow: 127, outflow: 76 },
  { month: "Jul", inflow: 139, outflow: 82 },
];

export const activities: ActivityItem[] = [
  {
    id: "INV-1048",
    title: "Invoice paid",
    detail: "Banaadir Trading Co.",
    amount: 8420,
    status: "paid",
    time: "12 min ago",
    kind: "invoice",
  },
  {
    id: "BILL-628",
    title: "Vendor bill awaiting approval",
    detail: "Horn Logistics",
    amount: -3180,
    status: "pending",
    time: "48 min ago",
    kind: "bill",
  },
  {
    id: "INV-1031",
    title: "Invoice overdue",
    detail: "Sahal Distributors",
    amount: 6250,
    status: "overdue",
    time: "2 hr ago",
    kind: "invoice",
  },
  {
    id: "TRF-209",
    title: "Warehouse transfer completed",
    detail: "Bakaaro → Hodan",
    amount: 0,
    status: "completed",
    time: "3 hr ago",
    kind: "transfer",
  },
];

