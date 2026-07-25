import type { ResourceConfig, ResourceRow } from "./resource-config";

const valuesByColumn: Record<string, string[]> = {
  Vendor: ["Horn Logistics", "Som Petroleum", "Mogadishu Imports", "Juba Office Supply", "Ocean Freight Co."],
  Customer: ["Banaadir Trading Co.", "Sahal Distributors", "Dayax Retail", "Amaan Services", "Hodan Supermarket"],
  Company: ["Banaadir Group", "Sahal Holdings", "Dayax Group", "Amaan Group", "Hodan Retail Ltd."],
  Amount: ["$18,420.00", "$12,250.00", "$7,180.00", "$22,760.00", "$4,940.00"],
  "Open balance": ["$8,420.00", "$6,250.00", "$0.00", "$12,760.00", "$2,940.00"],
  Balance: ["$84,250.00", "$31,780.00", "$18,600.00", "$9,420.00", "$146,380.00"],
  Phone: ["+252 61 555 0142", "+252 61 555 0288", "+252 65 555 1190", "+252 62 555 0441", "+252 61 555 0715"],
  Expected: ["29 Jul 2026", "02 Aug 2026", "05 Aug 2026", "08 Aug 2026", "12 Aug 2026"],
  Received: ["120 of 120", "84 of 100", "240 of 240", "36 of 50", "75 of 75"],
  Payee: ["Somtel", "Mogadishu Power", "Ocean Freight Co.", "Juba Office Supply", "City Water"],
  Submitted: ["26 Jul 2026", "25 Jul 2026", "24 Jul 2026", "22 Jul 2026", "20 Jul 2026"],
  Type: ["Operating expense", "Inventory purchase", "Capital expense", "Service contract", "Fuel purchase"],
  Account: ["Salaam Bank · 0182", "Premier Bank · 4407", "EVC Plus Merchant", "Cash on hand", "Dahabshiil Bank · 2291"],
  Currency: ["USD", "USD", "SOS", "USD", "EUR"],
  Difference: ["$0.00", "$125.00", "-$42.50", "$0.00", "$18.20"],
  From: ["Salaam Bank", "Premier Bank", "Bakaaro warehouse", "EVC Plus", "Main warehouse"],
  To: ["Premier Bank", "Cash on hand", "Hodan warehouse", "Salaam Bank", "Wadajir warehouse"],
  Period: ["Jul 2026", "Aug 2026", "Q3 2026", "Q4 2026", "FY 2027"],
  "Opening cash": ["$146,380", "$152,740", "$159,220", "$174,900", "$201,450"],
  "Closing cash": ["$152,740", "$159,220", "$174,900", "$201,450", "$228,600"],
  Item: ["Cement 50kg", "Premium Rice 25kg", "Cooking Oil 20L", "Steel Bar 12mm", "Office Chair Pro"],
  "On hand": ["1,248", "684", "295", "2,450", "86"],
  "Sales price": ["$9.50", "$31.00", "$28.00", "$7.80", "$145.00"],
  Available: ["1,126", "610", "248", "2,180", "74"],
  Warehouse: ["Bakaaro Central", "Hodan Distribution", "Wadajir Depot", "Main Warehouse", "Airport Store"],
  Code: ["BKR-01", "HDN-02", "WDJ-03", "MAIN", "AIR-05"],
  Items: ["842 SKUs", "615 SKUs", "438 SKUs", "1,204 SKUs", "176 SKUs"],
  Manager: ["Amina Yusuf", "Hassan Ali", "Maryan Omar", "Abdi Noor", "Khalid Ahmed"],
  Variance: ["0 units", "-12 units", "+5 units", "-3 units", "+18 units"],
  Assembly: ["Water Pack 24×500ml", "Office Starter Kit", "Retail Rice Bundle", "Construction Pack A", "Kitchen Essentials"],
  Quantity: ["250", "40", "125", "80", "55"],
  Description: ["Month-end accrual", "Inventory correction", "Bank fee allocation", "Payroll posting", "Depreciation entry"],
  Template: ["Monthly office rent", "Internet subscription", "Vehicle lease", "Software licenses", "Security services"],
  Frequency: ["Monthly", "Monthly", "Quarterly", "Monthly", "Weekly"],
  Start: ["01 Jan 2026", "01 Jul 2026", "01 Oct 2026", "01 Jan 2027", "01 Apr 2027"],
  End: ["31 Dec 2026", "30 Sep 2026", "31 Dec 2026", "31 Mar 2027", "30 Jun 2027"],
  Event: ["Invoice posted", "Bill approved", "Journal edited", "User signed in", "Account reconciled"],
  User: ["Abdikadir Qulle", "Amina Yusuf", "Hassan Ali", "Maryan Omar", "System"],
  Entity: ["Invoice INV-1048", "Bill BILL-0628", "Journal JE-0084", "User AK-001", "Account 1010"],
  Project: ["Hodan Warehouse Build", "Airport Retail Fit-out", "ERP Rollout", "Fleet Expansion", "Bakaaro Renovation"],
  Budget: ["$180,000", "$92,500", "$48,000", "$136,000", "$74,800"],
  Task: ["Foundation inspection", "Electrical installation", "Data migration", "Vehicle procurement", "Final handover"],
  Assignee: ["Hassan Ali", "Maryan Omar", "Abdi Noor", "Amina Yusuf", "Khalid Ahmed"],
  Employee: ["Ahmed Hassan", "Fadumo Ali", "Mohamed Noor", "Asha Omar", "Yusuf Abdi"],
  Hours: ["40.0 hrs", "37.5 hrs", "44.0 hrs", "32.0 hrs", "41.5 hrs"],
  Progress: ["75%", "42%", "90%", "28%", "100%"],
  Revenue: ["$126,400", "$84,200", "$48,000", "$62,750", "$91,300"],
  Cost: ["$82,100", "$61,450", "$29,700", "$54,900", "$66,200"],
  Margin: ["35.0%", "27.0%", "38.1%", "12.5%", "27.5%"],
  Employees: ["48 employees", "52 employees", "50 employees", "54 employees", "51 employees"],
  "Net pay": ["$42,680", "$45,120", "$43,950", "$47,300", "$44,820"],
  Department: ["Finance", "Sales", "Warehouse", "Operations", "Human Resources"],
  Week: ["20–26 Jul 2026", "13–19 Jul 2026", "06–12 Jul 2026", "29 Jun–05 Jul", "22–28 Jun 2026"],
  Days: ["5 days", "2 days", "10 days", "1 day", "7 days"],
  Deduction: ["$250 / month", "$180 / month", "$320 / month", "$125 / month", "$400 / month"],
  Report: ["Payroll summary", "Employee earnings", "Payroll liabilities", "Leave balances", "Loan balances"],
  Generated: ["26 Jul 2026", "25 Jul 2026", "22 Jul 2026", "18 Jul 2026", "01 Jul 2026"],
  "Legal name": ["Al-Furat Group LLC", "Al-Furat Trading Ltd.", "Al-Furat Logistics", "Al-Furat Retail", "Al-Furat Services"],
  "Fiscal year": ["Jan–Dec", "Jan–Dec", "Jul–Jun", "Jan–Dec", "Apr–Mar"],
  Branch: ["Main Office", "Hodan Branch", "Bakaaro Branch", "Wadajir Branch", "Bosaso Branch"],
  Role: ["Administrator", "Finance manager", "Sales manager", "Warehouse manager", "Accountant"],
  "Last active": ["2 minutes ago", "18 minutes ago", "1 hour ago", "Yesterday", "3 days ago"],
  Rate: ["1.0000", "57,100.00", "0.9234", "0.7812", "36.6400"],
  Updated: ["26 Jul 2026", "26 Jul 2026", "25 Jul 2026", "24 Jul 2026", "20 Jul 2026"],
  Tax: ["VAT Standard", "VAT Zero", "Withholding Tax", "Import Duty", "Non-taxable"],
  Authority: ["Ministry of Finance", "Customs Authority", "Revenue Directorate", "Municipal Authority", "Internal"],
  Workflow: ["Bills above $5,000", "Purchase order approval", "Journal posting", "Vendor onboarding", "Customer credit limit"],
  Document: ["Vendor bill", "Purchase order", "Journal entry", "Vendor profile", "Sales order"],
  Threshold: ["$5,000", "$10,000", "$2,500", "Any amount", "$15,000"],
  Approvers: ["Finance Manager → CFO", "Purchasing Manager → CEO", "Controller", "Compliance → Finance", "Sales Manager → CFO"],
};

const dates = ["26 Jul 2026", "25 Jul 2026", "23 Jul 2026", "21 Jul 2026", "18 Jul 2026"];
const statusesByResource: Record<string, string[]> = {
  invoices: ["Paid", "Overdue", "Pending", "Paid", "Draft"],
  customers: ["Active", "Active", "Credit hold", "Active", "Inactive"],
  estimates: ["Accepted", "Pending", "Expired", "Converted", "Draft"],
  "sales-orders": ["Fulfilled", "Partially fulfilled", "Open", "Fulfilled", "Draft"],
  payments: ["Deposited", "Undeposited", "Applied", "Deposited", "Pending"],
  "credit-notes": ["Applied", "Open", "Refunded", "Applied", "Draft"],
  approvals: ["Pending", "Approved", "Rejected", "Pending", "Approved"],
  reconciliation: ["Reconciled", "In progress", "Needs review", "Reconciled", "Draft"],
  "stock-levels": ["In stock", "Low stock", "Low stock", "In stock", "Out of stock"],
  "stock-counts": ["Completed", "In progress", "Posted", "Draft", "Needs review"],
  projects: ["Active", "Active", "On hold", "Planning", "Completed"],
  tasks: ["In progress", "Open", "Blocked", "Completed", "Open"],
  leave: ["Approved", "Pending", "Approved", "Rejected", "Pending"],
  "fiscal-periods": ["Open", "Open", "Soft closed", "Closed", "Closed"],
};

const prefixes: Record<string, string> = {
  invoices: "INV", customers: "CUS", estimates: "EST", "sales-orders": "SO", payments: "PMT",
  "credit-notes": "CM", bills: "BIL", vendors: "VEN", "purchase-orders": "PO", receipts: "RCV",
  expenses: "EXP", approvals: "APR", accounts: "ACC", transactions: "TXN", reconciliation: "REC",
  transfers: "TRF", "cash-flow": "FCST", items: "ITE", "stock-levels": "STK", warehouses: "WH",
  "stock-counts": "CNT", assemblies: "BLD", "chart-of-accounts": "CHA", "journal-entries": "JE",
  registers: "REG", recurring: "RCR", "fiscal-periods": "FY", "audit-log": "AUD", projects: "PRO",
  tasks: "TSK", time: "TIME", "progress-billing": "PINV", profitability: "PFT", "pay-runs": "PAY",
  employees: "EMP", timesheets: "TS", leave: "LV", loans: "LOAN", reports: "RPT",
};

function contextualValue(config: ResourceConfig, column: string, index: number) {
  if (/date$/i.test(column) || ["Due date", "Next date"].includes(column)) return dates[index];
  if (column === "Status") return statusesByResource[config.slug]?.[index] ?? "Active";
  if (column === "PO") return `PO-${String(780 + index)}`;
  if (column === "Invoice") return `INV-${String(1048 - index)}`;
  if (column === "SKU") return ["CEM-50", "RICE-25", "OIL-20", "STL-12", "CHR-PRO"][index];
  return valuesByColumn[column]?.[index] ?? `${column} ${index + 1}`;
}

export function createResourceRows(config: ResourceConfig): ResourceRow[] {
  const prefix = prefixes[config.slug] ?? config.slug.slice(0, 3).toUpperCase();
  const statuses = statusesByResource[config.slug] ?? ["Active", "Pending", "Completed", "Draft", "Active"];
  return Array.from({ length: 5 }, (_, index) => ({
    id: `${prefix}-${String(1048 - index).padStart(4, "0")}`,
    cells: config.columns.slice(1).map((column) => contextualValue(config, column, index)),
    status: statuses[index],
  }));
}

export function getResourcePresentation(module: string, slug: string): ResourceConfig["presentation"] {
  if (["cash-flow", "reconciliation", "profitability", "warehouses", "approvals"].includes(slug)) return "cards";
  if (module === "reports" || module === "settings") return "sections";
  return "table";
}

export function getResourceStats(config: ResourceConfig): ResourceConfig["stats"] {
  const statsByKey: Record<string, ResourceConfig["stats"]> = {
    purchasing: [
      { label: "Open payables", value: "$68,420", helper: "24 vendor bills" },
      { label: "Due this week", value: "$14,850", helper: "7 bills" },
      { label: "Open purchase orders", value: "$92,600", helper: "18 orders" },
      { label: "Awaiting approval", value: "6", helper: "Needs attention" },
    ],
    banking: [
      { label: "Cash available", value: "$146,380", helper: "Across 6 accounts" },
      { label: "Uncleared", value: "$8,240", helper: "14 transactions" },
      { label: "To reconcile", value: "3", helper: "Bank accounts" },
      { label: "30-day net flow", value: "+$31,450", helper: "Healthy position" },
    ],
    inventory: [
      { label: "Inventory value", value: "$428,650", helper: "3,275 active SKUs" },
      { label: "Low stock", value: "18", helper: "Reorder required" },
      { label: "Warehouses", value: "5", helper: "4 active branches" },
      { label: "Open transfers", value: "9", helper: "1 delayed" },
    ],
    accounting: [
      { label: "Assets", value: "$1.24M", helper: "Current period" },
      { label: "Liabilities", value: "$412,800", helper: "Current period" },
      { label: "Open period", value: "Jul 2026", helper: "Closes 31 Jul" },
      { label: "Unposted journals", value: "7", helper: "Needs review" },
    ],
    projects: [
      { label: "Active projects", value: "12", helper: "4 due this quarter" },
      { label: "Contract value", value: "$892,400", helper: "All active projects" },
      { label: "Unbilled work", value: "$48,620", helper: "Ready to invoice" },
      { label: "Average margin", value: "28.4%", helper: "+2.1% vs plan" },
    ],
    payroll: [
      { label: "Active employees", value: "52", helper: "5 departments" },
      { label: "Next net payroll", value: "$45,120", helper: "31 Jul 2026" },
      { label: "Leave pending", value: "6", helper: "Manager review" },
      { label: "Loan balance", value: "$18,460", helper: "11 employees" },
    ],
  };
  return statsByKey[config.module] ?? config.stats;
}
