import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDecimal(
  value: number | string,
  minimumFractionDigits = 2,
  maximumFractionDigits = 4,
) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return String(value);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(numeric);
}

export function formatDecimalInput(value: string | number) {
  const text = String(value);
  if (text === "" || !/^-?\d+(\.\d+)?$/.test(text)) return text;
  const [integer, fraction = ""] = text.split(".");
  if (!fraction) return `${integer}.00`;
  const meaningful = fraction.replace(/0+$/, "");
  return `${integer}.${meaningful.padEnd(2, "0")}`;
}

export function formatCurrency(
  value: number,
  currency = "USD",
  compact = false,
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 1 : 4,
  }).format(value);
}
