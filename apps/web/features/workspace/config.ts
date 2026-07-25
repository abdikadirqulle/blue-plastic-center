import type { LucideIcon } from "lucide-react";
import {
  Boxes,
  BriefcaseBusiness,
  ClipboardList,
  FileBarChart,
  Landmark,
  ReceiptText,
  Settings,
  ShoppingCart,
  WalletCards,
} from "lucide-react";

export interface WorkspaceRow {
  id: string;
  primary: string;
  secondary: string;
  value: string;
  status: "Active" | "Paid" | "Pending" | "Overdue" | "Draft" | "Posted" | "Low stock";
  date: string;
}

export interface WorkspaceConfig {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tabs: string[];
  primaryAction: string;
  formFields: string[];
  columns: string[];
  stats: Array<{ label: string; value: string; helper: string }>;
  rows: WorkspaceRow[];
}

const baseRows: WorkspaceRow[] = [
  { id: "AF-10041", primary: "Banaadir Trading Co.", secondary: "Main branch", value: "$8,420.00", status: "Paid", date: "25 Jul 2026" },
  { id: "AF-10040", primary: "Sahal Distributors", secondary: "Hodan branch", value: "$6,250.00", status: "Overdue", date: "23 Jul 2026" },
  { id: "AF-10039", primary: "Horn Logistics", secondary: "Bakaaro branch", value: "$3,180.00", status: "Pending", date: "22 Jul 2026" },
  { id: "AF-10038", primary: "Dayax Retail", secondary: "Wadajir branch", value: "$12,760.00", status: "Posted", date: "20 Jul 2026" },
  { id: "AF-10037", primary: "Amaan Services", secondary: "Main branch", value: "$2,940.00", status: "Draft", date: "19 Jul 2026" },
];

export const workspaceConfigs: Record<string, WorkspaceConfig> = {
  sales: {
    slug: "sales", title: "Sales & receivables", description: "Manage customers, estimates, orders, invoices, payments, and credit notes.", icon: ShoppingCart,
    tabs: ["Invoices", "Customers", "Estimates", "Sales orders", "Payments", "Credit notes"],
    primaryAction: "New invoice", formFields: ["Customer", "Invoice date", "Due date", "Item or service", "Amount"],
    columns: ["Invoice", "Customer", "Amount", "Status", "Date"],
    stats: [{label:"Open invoices",value:"$92,750",helper:"46 invoices"},{label:"Overdue",value:"$18,240",helper:"9 invoices"},{label:"Paid this month",value:"$126,840",helper:"+12.8%"},{label:"Average payment",value:"18 days",helper:"2 days faster"}],
    rows: baseRows,
  },
  purchasing: {
    slug: "purchasing", title: "Purchasing & expenses", description: "Control vendors, purchase orders, bills, expenses, approvals, and payments.", icon: ReceiptText,
    tabs: ["Bills", "Vendors", "Purchase orders", "Receipts", "Expenses", "Approvals"],
    primaryAction: "New vendor bill", formFields: ["Vendor", "Bill date", "Due date", "Expense account", "Amount"],
    columns: ["Bill", "Vendor", "Amount", "Status", "Date"],
    stats: [{label:"Open bills",value:"$61,280",helper:"31 bills"},{label:"Due this week",value:"$14,750",helper:"8 bills"},{label:"Purchases MTD",value:"$86,420",helper:"+5.2%"},{label:"Pending approval",value:"7",helper:"$12,360"}],
    rows: baseRows.map((row,index)=>({...row,id:`BILL-0${628-index}`,primary:["Horn Logistics","Som Petroleum","Mogadishu Imports","Blue Sky Supplies","Amaan Services"][index]})),
  },
  banking: {
    slug: "banking", title: "Banking & treasury", description: "Track bank, cash, mobile money, transfers, matching, and reconciliations.", icon: Landmark,
    tabs: ["Accounts", "Transactions", "Reconciliation", "Transfers", "Cash flow"],
    primaryAction: "Record transaction", formFields: ["Account", "Transaction type", "Date", "Reference", "Amount"],
    columns: ["Reference", "Account", "Amount", "Status", "Date"],
    stats: [{label:"Bank balance",value:"$118,630",helper:"4 accounts"},{label:"Cash on hand",value:"$27,750",helper:"3 locations"},{label:"Unmatched",value:"14",helper:"Needs review"},{label:"Reconciled",value:"96.8%",helper:"This month"}],
    rows: baseRows.map((row,index)=>({...row,id:`TRX-20${91-index}`,primary:["Salaam Bank USD","EVC Plus Main","Premier Bank","Petty Cash - HQ","eDahab Operations"][index],status:index===1?"Pending":"Posted"})),
  },
  inventory: {
    slug: "inventory", title: "Items & inventory", description: "Manage products, warehouses, bins, transfers, counts, serials, lots, and valuation.", icon: Boxes,
    tabs: ["Items", "Stock levels", "Warehouses", "Transfers", "Stock counts", "Assemblies"],
    primaryAction: "Add item", formFields: ["Item name", "SKU", "Category", "Warehouse", "Selling price"],
    columns: ["SKU", "Item", "Value", "Status", "Updated"],
    stats: [{label:"Inventory value",value:"$386,420",helper:"1,248 items"},{label:"Low stock",value:"18",helper:"Needs reorder"},{label:"Warehouses",value:"4",helper:"12 bins"},{label:"Stock turns",value:"5.8x",helper:"Annualized"}],
    rows: baseRows.map((row,index)=>({...row,id:`SKU-10${48-index}`,primary:["Cement 50kg","Premium Rice 25kg","Cooking Oil 20L","Steel Rebar 12mm","Office Paper A4"][index],secondary:["Bakaaro · 12 units","Hodan · 8 units","Wadajir · 5 units","Bakaaro · 186 units","HQ · 240 units"][index],status:index<3?"Low stock":"Active"})),
  },
  accounting: {
    slug: "accounting", title: "Accounting", description: "Manage the chart of accounts, journals, fiscal periods, registers, and closing.", icon: ClipboardList,
    tabs: ["Chart of accounts", "Journal entries", "Registers", "Recurring", "Fiscal periods", "Audit log"],
    primaryAction: "New journal entry", formFields: ["Journal date", "Reference", "Debit account", "Credit account", "Amount"],
    columns: ["Journal", "Description", "Amount", "Status", "Date"],
    stats: [{label:"Total assets",value:"$842,390",helper:"+4.1%"},{label:"Total liabilities",value:"$314,820",helper:"37.4% ratio"},{label:"Equity",value:"$527,570",helper:"Balanced"},{label:"Unposted journals",value:"6",helper:"$21,450"}],
    rows: baseRows.map((row,index)=>({...row,id:`JE-2026-0${512-index}`,primary:["Customer payment posting","Inventory cost recognition","Payroll accrual","Depreciation expense","Bank charge adjustment"][index],secondary:["Accounts receivable","Cost of goods sold","Payroll payable","Fixed assets","Bank fees"][index],status:index===4?"Draft":"Posted"})),
  },
  projects: {
    slug: "projects", title: "Projects & job costing", description: "Control budgets, tasks, committed costs, time, billing, and project profitability.", icon: BriefcaseBusiness,
    tabs: ["Projects", "Tasks", "Time", "Expenses", "Progress billing", "Profitability"],
    primaryAction: "New project", formFields: ["Project name", "Customer", "Start date", "Manager", "Budget"],
    columns: ["Project", "Customer", "Budget", "Status", "Due date"],
    stats: [{label:"Active projects",value:"12",helper:"4 at risk"},{label:"Contract value",value:"$428,000",helper:"Across 12 projects"},{label:"Costs to date",value:"$241,680",helper:"56.5%"},{label:"Gross margin",value:"31.4%",helper:"+2.6%"}],
    rows: baseRows.map((row,index)=>({...row,id:`PRJ-00${84-index}`,primary:["Hodan Warehouse Build","Bakaaro Store Fit-out","ERP Implementation","Fleet Expansion","Retail Launch"][index],status:index===2?"Pending":"Active"})),
  },
  payroll: {
    slug: "payroll", title: "Payroll & people", description: "Manage employees, pay runs, timesheets, leave, loans, deductions, and payslips.", icon: WalletCards,
    tabs: ["Pay runs", "Employees", "Timesheets", "Leave", "Loans", "Payroll reports"],
    primaryAction: "Start pay run", formFields: ["Pay period", "Payment date", "Department", "Bank account", "Notes"],
    columns: ["Reference", "Employee or run", "Net pay", "Status", "Date"],
    stats: [{label:"Employees",value:"84",helper:"79 active"},{label:"Gross payroll",value:"$42,680",helper:"July 2026"},{label:"Deductions",value:"$5,430",helper:"12.7%"},{label:"Net payroll",value:"$37,250",helper:"Pending approval"}],
    rows: baseRows.map((row,index)=>({...row,id:`PAY-2026-0${7-index}`,primary:["July payroll run","Ahmed Mohamed","Fadumo Ali","Mohamed Hassan","Hodan Yusuf"][index],secondary:["84 employees","Finance","Sales","Warehouse","Operations"][index],status:index===0?"Pending":"Paid"})),
  },
  reports: {
    slug: "reports", title: "Reports & insights", description: "Run financial, sales, purchasing, inventory, payroll, and custom reports.", icon: FileBarChart,
    tabs: ["Financial", "Sales", "Purchasing", "Inventory", "Payroll", "Custom"],
    primaryAction: "Create custom report", formFields: ["Report name", "Report type", "Date range", "Group by", "Columns"],
    columns: ["Report", "Category", "Last run", "Status", "Owner"],
    stats: [{label:"Saved reports",value:"28",helper:"6 custom"},{label:"Scheduled",value:"8",helper:"Next: tomorrow"},{label:"Exports this month",value:"42",helper:"PDF and Excel"},{label:"Favorites",value:"9",helper:"Quick access"}],
    rows: [
      {id:"RPT-001",primary:"Profit and Loss",secondary:"Financial",value:"25 Jul 2026",status:"Active",date:"Abdikadir"},
      {id:"RPT-002",primary:"Balance Sheet",secondary:"Financial",value:"25 Jul 2026",status:"Active",date:"Abdikadir"},
      {id:"RPT-003",primary:"Accounts Receivable Aging",secondary:"Sales",value:"24 Jul 2026",status:"Active",date:"Finance"},
      {id:"RPT-004",primary:"Inventory Valuation",secondary:"Inventory",value:"23 Jul 2026",status:"Active",date:"Warehouse"},
      {id:"RPT-005",primary:"Payroll Summary",secondary:"Payroll",value:"20 Jul 2026",status:"Active",date:"HR"},
    ],
  },
  settings: {
    slug: "settings", title: "Company settings", description: "Configure companies, branches, currencies, taxes, users, roles, workflows, and preferences.", icon: Settings,
    tabs: ["Company", "Branches", "Users & roles", "Currencies", "Taxes", "Workflows"],
    primaryAction: "Invite user", formFields: ["Full name", "Email", "Role", "Branch", "Access level"],
    columns: ["Reference", "Setting or user", "Value", "Status", "Updated"],
    stats: [{label:"Companies",value:"3",helper:"All active"},{label:"Branches",value:"7",helper:"4 cities"},{label:"Users",value:"26",helper:"22 active"},{label:"Custom roles",value:"8",helper:"42 permissions"}],
    rows: [
      {id:"USR-001",primary:"Abdikadir Qulle",secondary:"Administrator",value:"All companies",status:"Active",date:"Today"},
      {id:"USR-002",primary:"Amina Hassan",secondary:"Finance manager",value:"Main company",status:"Active",date:"Yesterday"},
      {id:"USR-003",primary:"Mohamed Ali",secondary:"Warehouse manager",value:"2 warehouses",status:"Active",date:"22 Jul"},
      {id:"CFG-004",primary:"USD functional currency",secondary:"Currency",value:"USD",status:"Active",date:"20 Jul"},
      {id:"CFG-005",primary:"Invoice approval workflow",secondary:"Workflow",value:">$5,000",status:"Active",date:"18 Jul"},
    ],
  },
};
