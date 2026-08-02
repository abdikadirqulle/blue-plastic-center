import { formatDecimal } from "../../lib/utils";

/**
 * Maps a column heading to the field that holds its value.
 *
 * Balances, stock on hand and reference names are calculated by the API and
 * arrive on the record, so a heading only ever needs to name the right field.
 * Nothing here falls back to a figure someone typed into a form: an opening
 * balance is not a balance, and an opening quantity is not stock on hand.
 */
const aliases: Record<string, string[]> = {
  document: ["documentNumber", "reference", "code"],
  invoice: ["documentNumber", "invoiceNumber", "reference"],
  receipt: ["documentNumber", "receiptNumber", "reference"],
  bill: ["documentNumber", "billNumber", "reference"],
  payment: ["documentNumber", "paymentNumber", "reference"],
  expense: ["documentNumber", "reference"],
  journal: ["documentNumber", "journalNumber", "reference"],
  reference: ["reference", "memo", "documentNumber"],
  report: ["reportName", "name"],
  sku: ["sku"],
  item: ["name", "itemName", "description"],
  name: ["name", "displayName", "accountName", "projectName"],
  customer: ["customerName", "displayName", "customer"],
  vendor: ["vendorName", "displayName", "vendor"],
  payee: ["payee", "vendorName"],
  account: ["accountName", "name"],
  "account number": ["accountNumber"],
  "account name": ["accountName", "name"],
  "bank account": ["bankAccount", "paymentAccount", "depositTo"],
  company: ["companyName", "tradingName", "legalName"],
  "legal name": ["legalName", "companyName"],
  branch: ["branchName", "name"],
  code: ["branchCode", "code", "sku"],
  manager: ["manager", "owner"],
  user: ["fullName", "name", "email"],
  role: ["role"],
  type: ["type", "accountType", "transactionType"],
  category: ["category", "kind"],
  description: ["description", "memo", "salesDescription", "notes"],
  "invoice date": ["invoiceDate", "transactionDate", "date"],
  "sale date": ["saleDate", "receiptDate", "transactionDate", "date"],
  "bill date": ["billDate"],
  "payment date": ["paymentDate"],
  "due date": ["dueDate"],
  "fiscal year": ["fiscalYearStart", "fiscalYear"],
  date: ["date", "paymentDate", "billDate", "expenseDate", "transactionDate", "journalDate"],
  "payment method": ["paymentMethod"],
  amount: ["amount", "total", "totalPayment", "debitAmount", "grossPay", "cost"],
  "paid amount": ["amountPaid", "paidAmount"],
  total: ["total", "amount"],
  "balance due": ["balanceDue", "outstanding"],
  "open balance": ["openBalance"],
  overdue: ["overdueBalance"],
  balance: ["balance", "openBalance", "balanceDue"],
  "on hand": ["quantityOnHand"],
  value: ["inventoryValue", "value"],
  "sales price": ["salesPrice", "unitPrice", "rate"],
  "cost price": ["purchaseCost", "costPrice", "cost"],
  "average cost": ["averageCost"],
  cost: ["cost", "purchaseCost", "amount"],
  phone: ["phone", "mobile"],
  status: ["status"],
};

const moneyColumn = /amount|total|balance|price|cost|value|debit|credit|overdue/i;

/** Figures read faster right-aligned; text reads faster left-aligned. */
export function isNumericColumn(column: string) {
  return moneyColumn.test(column) || /on hand|quantity|qty/i.test(column);
}

function display(value: unknown, money: boolean) {
  if (value === undefined || value === null || value === "") return "—";
  if (Array.isArray(value)) return `${value.length} line${value.length === 1 ? "" : "s"}`;
  if (typeof value === "object") return "Details";
  const text = String(value);
  if (money && /^-?\d+(\.\d+)?$/.test(text)) return formatDecimal(text);
  if (/^-?\d+\.\d+$/.test(text)) return formatDecimal(text);
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
