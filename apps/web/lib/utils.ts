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

const scale = 10_000n;

function toMinor(value: unknown) {
  const text = String(value ?? "").replace(/[^0-9.-]/g, "");
  if (!/^-?\d*(\.\d+)?$/.test(text) || text === "" || text === "-") return 0n;
  const negative = text.startsWith("-");
  const [whole = "0", fraction = ""] = (negative ? text.slice(1) : text).split(".");
  const minor =
    BigInt(whole || "0") * scale + BigInt(fraction.padEnd(4, "0").slice(0, 4));
  return negative ? -minor : minor;
}

export function compareDecimals(left: unknown, right: unknown) {
  const difference = toMinor(left) - toMinor(right);
  return difference < 0n ? -1 : difference > 0n ? 1 : 0;
}

export function subtractDecimals(left: unknown, right: unknown) {
  return sumDecimals([left, `-${String(right ?? "0")}`]);
}

/**
 * Adds decimal strings exactly. Money never passes through a float, not even
 * for a figure that is only shown on a summary card.
 */
export function sumDecimals(values: unknown[]) {
  const total = values.reduce<bigint>((sum, value) => sum + toMinor(value), 0n);
  const negative = total < 0n;
  const absolute = negative ? -total : total;
  return `${negative ? "-" : ""}${absolute / scale}.${String(absolute % scale).padStart(4, "0")}`;
}

export function formatDecimalInput(value: string | number) {
  const text = String(value);
  if (text === "" || !/^-?\d+(\.\d+)?$/.test(text)) return text;
  const [integer, fraction = ""] = text.split(".");
  if (!fraction) return `${integer}.00`;
  const meaningful = fraction.replace(/0+$/, "");
  return `${integer}.${meaningful.padEnd(2, "0")}`;
}

export function formatQuantityInput(value: string | number) {
  const text = String(value);
  if (text === "" || !/^-?\d+(\.\d+)?$/.test(text)) return text;
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) return text;
  return String(numeric);
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
