export type TrendDirection = "up" | "down" | "neutral";

export interface FinancialMetric {
  label: string;
  value: number;
  change: number;
  trend: TrendDirection;
  helper: string;
}

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  amount: number;
  status: "paid" | "pending" | "overdue" | "completed";
  time: string;
  kind: "invoice" | "bill" | "payment" | "transfer";
}

