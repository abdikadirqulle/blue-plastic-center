import type {
  OperationRecord,
  OperationsModule,
  OperationsResource,
} from "../domain/operation-record";

const vendors = ["Polymer Gulf LLC", "East Africa Resins", "Mogadishu Packaging", "Global Colorants", "Hodan Logistics"];
const items = ["HDPE Resin 5502", "Blue Masterbatch", "28 mm Bottle Cap", "5 L Jerrycan", "Shrink Film Roll"];
const banks = ["Premier Operating · 2048", "Salaam Bank · 1182", "Petty Cash · Main", "USD Clearing · 0094", "Mobile Money · 7712"];
const amounts = ["$18,420.00", "$12,250.00", "$7,180.00", "$22,760.00", "$4,940.00"];
const dates = ["2026-07-26", "2026-07-25", "2026-07-23", "2026-07-21", "2026-07-19"];

const resourceData: Partial<Record<OperationsResource, {
  names: string[];
  secondary: string[];
  statuses: string[];
  meta: Array<Record<string, string>>;
}>> = {
  bills: { names: vendors, secondary: ["Net 30", "Due in 7 days", "Overdue 4 days", "Net 15", "Due today"], statuses: ["Open", "Partially paid", "Overdue", "Paid", "Draft"], meta: [{ due: "2026-08-25" }, { due: "2026-08-02" }, { due: "2026-07-22" }, { due: "2026-08-05" }, { due: "2026-07-26" }] },
  vendors: { names: vendors, secondary: ["Raw materials", "Resins", "Packaging", "Colorants", "Freight"], statuses: ["Active", "Active", "On hold", "Active", "Active"], meta: [{ balance: "$31,640" }, { balance: "$12,250" }, { balance: "$7,180" }, { balance: "$0" }, { balance: "$4,940" }] },
  "purchase-orders": { names: vendors, secondary: ["120 MT resin", "45 MT HDPE", "Packaging supplies", "Color masterbatch", "Ocean freight"], statuses: ["Partially received", "Open", "Approved", "Closed", "Pending approval"], meta: [{ received: "72 / 120" }, { received: "0 / 45" }, { received: "0 / 640" }, { received: "80 / 80" }, { received: "0 / 1" }] },
  receipts: { names: vendors, secondary: ["PO-1088 · Main warehouse", "PO-1084 · Resin yard", "PO-1081 · Main warehouse", "PO-1079 · Production", "PO-1075 · Main warehouse"], statuses: ["Partial", "Received", "QC hold", "Billed", "Received"], meta: [{ quantity: "72 MT" }, { quantity: "45 MT" }, { quantity: "640 units" }, { quantity: "80 bags" }, { quantity: "1 container" }] },
  "bill-payments": { names: vendors, secondary: banks, statuses: ["Scheduled", "Paid", "Needs approval", "Cleared", "Voided"], meta: [{ bills: "3 bills" }, { bills: "1 bill" }, { bills: "2 bills" }, { bills: "4 bills" }, { bills: "1 bill" }] },
  "vendor-credits": { names: vendors, secondary: ["Damaged resin", "Price adjustment", "Packaging return", "Quality variance", "Freight claim"], statuses: ["Available", "Applied", "Pending", "Applied", "Available"], meta: [{ available: "$3,420" }, { available: "$0" }, { available: "$7,180" }, { available: "$0" }, { available: "$4,940" }] },
  expenses: { names: ["Port handling", "Factory utilities", "Vehicle fuel", "Customs clearing", "Equipment service"], secondary: ["Cost of goods sold", "Utilities", "Vehicle expense", "Inventory asset", "Repairs"], statuses: ["Posted", "Approved", "Pending approval", "Posted", "Draft"], meta: [{ method: "Bank" }, { method: "Direct debit" }, { method: "Cash" }, { method: "Check" }, { method: "Card" }] },
  checks: { names: vendors, secondary: ["Check 008821", "Check 008820", "Check 008819", "Check 008818", "Check 008817"], statuses: ["Printed", "Cleared", "To print", "Voided", "Cleared"], meta: [{ account: "Premier Operating" }, { account: "Salaam Bank" }, { account: "Premier Operating" }, { account: "Salaam Bank" }, { account: "Premier Operating" }] },
  approvals: { names: ["PO-1088 · Polymer Gulf", "BILL-2084 · East Africa Resins", "EXP-6048 · Port handling", "VC-3018 · Mogadishu Packaging", "PO-1089 · Hodan Logistics"], secondary: ["Requested by Ahmed", "Requested by Fadumo", "Requested by Abdi", "Requested by Maryan", "Requested by Khalid"], statuses: ["Awaiting CFO", "Awaiting manager", "Changes requested", "Approved", "Awaiting manager"], meta: [{ age: "4 hours" }, { age: "1 day" }, { age: "2 days" }, { age: "Approved today" }, { age: "20 minutes" }] },
  items: { names: items, secondary: ["Raw material · HDPE", "Raw material · Color", "Assembly component", "Finished good", "Packaging"], statuses: ["In stock", "Low stock", "In stock", "Backordered", "In stock"], meta: [{ sku: "RM-HDPE-5502" }, { sku: "RM-MB-BLUE" }, { sku: "CP-CAP-28" }, { sku: "FG-JC-5L" }, { sku: "PK-SHRINK-01" }] },
  "stock-levels": { names: items, secondary: ["Resin yard", "Production store", "Component store", "Finished goods", "Packaging store"], statuses: ["Healthy", "Reorder", "Healthy", "Shortage", "Healthy"], meta: [{ available: "284 MT" }, { available: "12 bags" }, { available: "184,000" }, { available: "-2,400" }, { available: "420 rolls" }] },
  warehouses: { names: ["Main warehouse", "Resin yard", "Production store", "Finished goods", "Transit warehouse"], secondary: ["Mogadishu HQ", "Factory north", "Factory floor", "Factory south", "Port"], statuses: ["Active", "Active", "Active", "Active", "Restricted"], meta: [{ bins: "48 bins" }, { bins: "12 silos" }, { bins: "24 bins" }, { bins: "60 bins" }, { bins: "8 zones" }] },
  transfers: { names: ["TRF-4098", "TRF-4097", "TRF-4096", "TRF-4095", "TRF-4094"], secondary: ["Resin yard → Production", "Production → Finished goods", "Port → Resin yard", "Main → Production", "Finished goods → Main"], statuses: ["In transit", "Received", "Pending", "Received", "Cancelled"], meta: [{ quantity: "32 MT" }, { quantity: "8,400 units" }, { quantity: "4 containers" }, { quantity: "12 pallets" }, { quantity: "3 pallets" }] },
  "stock-counts": { names: ["July resin cycle count", "Cap components count", "Finished goods count", "Port inventory count", "Quarter-end full count"], secondary: ["Resin yard", "Component store", "Finished goods", "Transit warehouse", "All locations"], statuses: ["In progress", "Completed", "Variance review", "Scheduled", "Approved"], meta: [{ variance: "0.8%" }, { variance: "0.1%" }, { variance: "2.4%" }, { variance: "—" }, { variance: "0.4%" }] },
  assemblies: { names: ["5 L Blue Jerrycan", "20 L White Jerrycan", "28 mm Blue Cap", "1 L Bottle", "10 L Bucket"], secondary: ["BOM-501", "BOM-498", "BOM-492", "BOM-487", "BOM-480"], statuses: ["Build ready", "Material shortage", "In production", "Released", "Draft"], meta: [{ buildable: "12,400 units" }, { buildable: "0 units" }, { buildable: "84,000 units" }, { buildable: "22,000 units" }, { buildable: "—" }] },
  adjustments: { names: items, secondary: ["Damage write-off", "Cycle count gain", "Production scrap", "Opening correction", "Sample issue"], statuses: ["Posted", "Pending approval", "Posted", "Draft", "Posted"], meta: [{ change: "-1.2 MT" }, { change: "+4 bags" }, { change: "-1,200 units" }, { change: "+320 units" }, { change: "-6 rolls" }] },
  "lots-serials": { names: ["LOT-HDPE-2607A", "LOT-MB-2607B", "SER-MOLD-8842", "LOT-CAP-2606F", "LOT-SHR-2607C"], secondary: items, statuses: ["Released", "QC hold", "In service", "Expiring soon", "Released"], meta: [{ expiry: "2027-07-20" }, { expiry: "2027-02-14" }, { expiry: "—" }, { expiry: "2026-09-10" }, { expiry: "2028-01-04" }] },
  "reorder-planning": { names: items, secondary: ["Lead time 21 days", "Lead time 14 days", "Lead time 9 days", "Lead time 2 days", "Lead time 18 days"], statuses: ["Order now", "Order now", "Healthy", "Critical", "Watch"], meta: [{ suggested: "160 MT" }, { suggested: "80 bags" }, { suggested: "0" }, { suggested: "28,000 units" }, { suggested: "120 rolls" }] },
  fulfillment: { names: ["SO-2098 · Dayax Retail", "SO-2097 · Banaadir Trading", "SO-2096 · Sahal Distributors", "SO-2095 · Horn Logistics", "SO-2094 · Amaan Services"], secondary: ["18 lines", "6 lines", "12 lines", "4 lines", "8 lines"], statuses: ["Picking", "Packed", "Shipped", "Backordered", "Ready to pick"], meta: [{ progress: "42%" }, { progress: "100%" }, { progress: "Delivered Jul 25" }, { progress: "3 lines short" }, { progress: "Allocated" }] },
  "landed-costs": { names: ["Container MSKU-4821", "Container TLLU-9042", "Air freight AF-2081", "Container CMAU-7712", "Local delivery LD-842"], secondary: ["Freight + duty", "Freight + insurance", "Freight", "Freight + duty + port", "Delivery"], statuses: ["Allocated", "Pending allocation", "Posted", "In review", "Posted"], meta: [{ allocation: "By quantity" }, { allocation: "By value" }, { allocation: "By weight" }, { allocation: "By value" }, { allocation: "Manual" }] },
  accounts: { names: banks, secondary: ["Bank", "Bank", "Cash", "Clearing", "Mobile wallet"], statuses: ["Connected", "Connected", "Active", "Needs review", "Connected"], meta: [{ balance: "$284,420" }, { balance: "$102,250" }, { balance: "$7,180" }, { balance: "$22,760" }, { balance: "$14,940" }] },
  transactions: { names: ["Polymer Gulf payment", "Customer deposit", "Factory utilities", "Inter-account transfer", "Port handling"], secondary: banks, statuses: ["Cleared", "Posted", "Pending", "Matched", "Uncleared"], meta: [{ type: "Expense" }, { type: "Deposit" }, { type: "Expense" }, { type: "Transfer" }, { type: "Check" }] },
  "bank-feeds": { names: ["POLYMER GULF LLC", "BANAADIR TRADING", "MOGADISHU POWER", "TRANSFER 2048-1182", "PORT AUTHORITY"], secondary: ["Possible match: BILL-2088", "Possible match: DEP-3028", "Rule: Factory utilities", "Possible transfer", "Possible match: EXP-6048"], statuses: ["For review", "Matched", "Rule applied", "For review", "Excluded"], meta: [{ confidence: "98%" }, { confidence: "100%" }, { confidence: "Rule" }, { confidence: "95%" }, { confidence: "—" }] },
  "bank-rules": { names: ["Factory utilities", "Fuel stations", "Customer transfers", "Bank service fees", "Port charges"], secondary: ["Contains MOGADISHU POWER", "Contains SOM OIL", "Description starts DEP", "Amount below $50", "Contains PORT AUTHORITY"], statuses: ["Active", "Active", "Active", "Paused", "Active"], meta: [{ action: "Categorize" }, { action: "Categorize" }, { action: "Record deposit" }, { action: "Record expense" }, { action: "Match expense" }] },
  reconciliation: { names: banks, secondary: ["Statement Jul 2026", "Statement Jul 2026", "Cash count Jul 2026", "Statement Jun 2026", "Statement Jul 2026"], statuses: ["In progress", "Ready to finish", "Not started", "Reconciled", "Difference"], meta: [{ difference: "$1,240.00" }, { difference: "$0.00" }, { difference: "—" }, { difference: "$0.00" }, { difference: "$84.20" }] },
  deposits: { names: ["Undeposited customer receipts", "Dayax Retail cash sale", "Banaadir ACH receipts", "Card settlement", "Mobile money settlement"], secondary: banks, statuses: ["To deposit", "Deposited", "In transit", "Cleared", "Pending"], meta: [{ payments: "8 payments" }, { payments: "1 receipt" }, { payments: "4 payments" }, { payments: "18 receipts" }, { payments: "12 receipts" }] },
  "cash-flow": { names: ["Base operating forecast", "Raw material purchase plan", "Sales collection scenario", "Expansion scenario", "13-week treasury forecast"], secondary: ["13 weeks", "8 weeks", "12 weeks", "12 months", "13 weeks"], statuses: ["Current", "Needs refresh", "Current", "Draft", "Current"], meta: [{ ending: "$348,200" }, { ending: "$92,400" }, { ending: "$512,800" }, { ending: "-$84,000" }, { ending: "$284,600" }] },
};

export function createMockOperationRecords(
  module: OperationsModule,
  resource: OperationsResource,
): OperationRecord[] {
  const data = resourceData[resource] ?? {
    names: ["Operations record A", "Operations record B", "Operations record C", "Operations record D", "Operations record E"],
    secondary: ["Main company", "Main company", "Main company", "Main company", "Main company"],
    statuses: ["Active", "Pending", "Posted", "Draft", "Closed"],
    meta: [{}, {}, {}, {}, {}],
  };
  return data.names.map((name, index) => ({
    id: `${resource.replaceAll("-", "").slice(0, 3).toUpperCase()}-${String(2088 - index)}`,
    module,
    resource,
    name,
    secondary: data.secondary[index] ?? "",
    amount: amounts[index] ?? "$0.00",
    date: dates[index] ?? dates[0],
    status: data.statuses[index] ?? "Active",
    reference: `${resource.toUpperCase()}-${2088 - index}`,
    meta: data.meta[index] ?? {},
  }));
}
