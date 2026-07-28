const aliases: Record<string, string[]> = {
  document: ["documentNumber", "reference", "code"],
  invoice: ["documentNumber", "invoiceNumber", "reference"],
  receipt: ["documentNumber", "receiptNumber", "reference"],
  bill: ["documentNumber", "billNumber", "reference"],
  sku: ["sku"],
  item: ["name", "itemName", "description"],
  name: ["name", "displayName", "accountName", "projectName"],
  customer: ["customerName", "displayName", "customerId"],
  vendor: ["vendorName", "displayName", "vendorId"],
  account: ["accountName", "name", "accountId"],
  type: ["type", "accountType", "transactionType"],
  "invoice date": ["invoiceDate", "transactionDate", "date"],
  "sale date": ["saleDate", "receiptDate", "transactionDate", "date"],
  "due date": ["dueDate"],
  date: ["date", "transactionDate", "createdAt"],
  "payment method": ["paymentMethod"],
  amount: ["amount", "total", "grossPay", "cost"],
  total: ["total", "amount"],
  "balance due": ["balanceDue", "outstanding", "balance"],
  balance: ["balance", "balanceDue", "openingBalance"],
  "on hand": ["quantityOnHand", "onHand", "openingQuantity", "quantity"],
  "sales price": ["salesPrice", "unitPrice", "rate"],
  "cost price": ["purchaseCost", "costPrice", "cost"],
  cost: ["cost", "purchaseCost", "amount"],
  status: ["status"],
};

const moneyColumn = /amount|total|balance|price|cost|value|debit|credit/i;

function display(value: unknown, money: boolean) {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return `${value.length} line${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return "Details";
  const text = String(value);
  if (money && /^-?\d+(\.\d+)?$/.test(text))
    return `$${Number(text).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return text;
}

export function tableCellValue(
  column: string,
  data: Record<string, unknown> | undefined,
  fallback: Record<string, string> = {},
) {
  const key = column.trim().toLowerCase();
  const source = data ?? {};
  const candidates = [
    ...(aliases[key] ?? []),
    column.replace(/[^a-zA-Z0-9]+(.)/g, (_, character: string) => character.toUpperCase()).replace(/^[A-Z]/, (character) => character.toLowerCase()),
  ];
  const field = candidates.find((candidate) => source[candidate] !== undefined && source[candidate] !== "");
  return display(field ? source[field] : fallback[key], moneyColumn.test(column));
}
