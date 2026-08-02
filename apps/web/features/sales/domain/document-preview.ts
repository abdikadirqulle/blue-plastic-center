import { formatDecimal } from "../../../lib/utils";

/**
 * The printable form of a sales document.
 *
 * Every figure here comes from the stored record: the server calculates line
 * totals and document totals, so the preview and the PDF show exactly what was
 * saved and posted rather than an illustration of it.
 */
export interface PreviewLine {
  description: string;
  quantity: string;
  rate: string;
  amount: string;
}

export interface PreviewTotal {
  label: string;
  value: string;
  strong?: boolean;
}

export interface DocumentPreview {
  documentNumber: string;
  documentTitle: string;
  partyLabel: string;
  partyName: string;
  date?: string;
  dueDate?: string;
  currency: string;
  reference?: string;
  memo?: string;
  lines: PreviewLine[];
  totals: PreviewTotal[];
}

const dateFields = [
  "invoiceDate",
  "saleDate",
  "receiptDate",
  "paymentDate",
  "billDate",
  "date",
];

const totalFields: Array<{ key: string; label: string; strong?: boolean }> = [
  { key: "subtotal", label: "Subtotal" },
  { key: "discountTotal", label: "Discount" },
  { key: "taxTotal", label: "Tax" },
  { key: "total", label: "Total", strong: true },
  { key: "amountPaid", label: "Paid" },
  { key: "balanceDue", label: "Balance due", strong: true },
];

function text(value: unknown) {
  return value === undefined || value === null || value === ""
    ? undefined
    : String(value);
}

function money(value: unknown) {
  const raw = text(value);
  if (raw === undefined) return undefined;
  return /^-?\d+(\.\d+)?$/.test(raw) ? formatDecimal(raw) : raw;
}

export function buildDocumentPreview(
  data: Record<string, unknown>,
  options: {
    documentNumber: string;
    documentTitle: string;
    resolveReference: (value: unknown) => string;
  },
): DocumentPreview {
  const { resolveReference } = options;
  const isPurchase = data.vendorId !== undefined || data.vendorName !== undefined;
  const partyName =
    text(data.customerName) ??
    text(data.vendorName) ??
    (data.customerId || data.vendorId
      ? resolveReference(data.customerId ?? data.vendorId)
      : undefined) ??
    "—";
  const rawLines = Array.isArray(data.lines)
    ? (data.lines as Array<Record<string, unknown>>)
    : [];

  return {
    documentNumber: options.documentNumber,
    documentTitle: options.documentTitle,
    partyLabel: isPurchase ? "Vendor" : "Bill to",
    partyName,
    date: text(dateFields.map((field) => data[field]).find(Boolean)),
    dueDate: text(data.dueDate),
    currency: text(data.currency) ?? "USD",
    reference: text(data.reference ?? data.customerPo ?? data.purchaseOrder),
    memo: text(data.memo ?? data.notes ?? data.description),
    lines: rawLines.map((line) => ({
      description:
        text(line.description) ??
        (line.itemId || line.accountId
          ? resolveReference(line.itemId ?? line.accountId)
          : undefined) ??
        "—",
      quantity: text(line.quantity) ?? "1",
      rate: money(line.unitPrice ?? line.rate) ?? "—",
      amount: money(line.lineTotal) ?? "—",
    })),
    totals: totalFields
      .filter(({ key }) => text(data[key]) !== undefined)
      .map(({ key, label, strong }) => ({
        label,
        value: money(data[key]) ?? "—",
        ...(strong ? { strong } : {}),
      })),
  };
}
