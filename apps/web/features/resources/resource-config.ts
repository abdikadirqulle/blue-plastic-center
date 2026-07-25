import {
  createResourceRows,
  getResourcePresentation,
  getResourceStats,
} from "./resource-mock-data";

export type FieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "select"
  | "textarea"
  | "checkbox";

export interface FormField {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  width?: "half" | "third" | "full";
}

export interface FormSection {
  title: string;
  description?: string;
  fields: FormField[];
}

export interface ResourceRow {
  id: string;
  cells: string[];
  status: string;
}

export interface ResourceConfig {
  module: string;
  moduleTitle: string;
  slug: string;
  title: string;
  description: string;
  primaryAction: string;
  searchPlaceholder: string;
  columns: string[];
  stats: Array<{ label: string; value: string; helper: string }>;
  formSections: FormSection[];
  hasLineItems?: boolean;
  rows: ResourceRow[];
  presentation?: "table" | "cards" | "sections";
}

export interface ModuleDefinition {
  title: string;
  description: string;
  resources: Array<{ slug: string; label: string }>;
}

const statuses = ["Paid", "Overdue", "Pending", "Posted", "Draft"];

function sampleRows(prefix: string, subjects: string[], values: string[]): ResourceRow[] {
  return subjects.map((subject, index) => ({
    id: `${prefix}-${String(1048 - index).padStart(4, "0")}`,
    cells: [subject, values[index] ?? values[0], ["25 Jul 2026", "23 Jul 2026", "22 Jul 2026", "20 Jul 2026", "19 Jul 2026"][index] ?? "18 Jul 2026"],
    status: statuses[index] ?? "Active",
  }));
}

const addressFields: FormSection = {
  title: "Billing & shipping",
  description: "Addresses printed on the transaction and used for fulfillment.",
  fields: [
    { name: "billAddress1", label: "Billing address line 1", type: "text", width: "half" },
    { name: "billAddress2", label: "Billing address line 2", type: "text", width: "half" },
    { name: "billCity", label: "Billing city", type: "text", width: "third" },
    { name: "billState", label: "Billing state/region", type: "text", width: "third" },
    { name: "billPostal", label: "Billing postal code", type: "text", width: "third" },
    { name: "billCountry", label: "Billing country", type: "text", width: "half" },
    { name: "shipAddress1", label: "Shipping address line 1", type: "text", width: "half" },
    { name: "shipAddress2", label: "Shipping address line 2", type: "text", width: "half" },
    { name: "shipCity", label: "Shipping city", type: "text", width: "third" },
    { name: "shipState", label: "Shipping state/region", type: "text", width: "third" },
    { name: "shipPostal", label: "Shipping postal code", type: "text", width: "third" },
    { name: "shipCountry", label: "Shipping country", type: "text", width: "half" },
  ],
};

const transactionTotals: FormSection = {
  title: "Totals, tax & payment",
  fields: [
    { name: "customerMessage", label: "Customer message", type: "select", options: ["Thank you for your business", "We appreciate your prompt payment", "Custom message"], width: "half" },
    { name: "memo", label: "Internal memo", type: "textarea", width: "half" },
    { name: "discountType", label: "Discount type", type: "select", options: ["None", "Percentage", "Fixed amount"], width: "third" },
    { name: "discountValue", label: "Discount value", type: "number", width: "third" },
    { name: "salesTaxItem", label: "Sales tax item", type: "select", options: ["Non-taxable", "Standard tax", "Zero rated", "Custom"], width: "third" },
    { name: "taxRate", label: "Tax rate %", type: "number", width: "third" },
    { name: "deposit", label: "Deposit applied", type: "number", width: "third" },
    { name: "currency", label: "Currency", type: "select", options: ["USD", "SOS", "EUR", "GBP"], required: true, width: "third" },
    { name: "exchangeRate", label: "Exchange rate", type: "number", width: "third" },
    { name: "emailLater", label: "Email later", type: "checkbox", width: "third" },
    { name: "printLater", label: "Print later", type: "checkbox", width: "third" },
  ],
};

const salesRows = sampleRows(
  "INV",
  ["Banaadir Trading Co.", "Sahal Distributors", "Horn Logistics", "Dayax Retail", "Amaan Services"],
  ["$8,420.00", "$6,250.00", "$3,180.00", "$12,760.00", "$2,940.00"],
);

export const moduleDefinitions: Record<string, ModuleDefinition> = {
  sales: {
    title: "Sales & receivables",
    description: "Customers, estimates, orders, invoices, payments, and credits.",
    resources: [
      { slug: "invoices", label: "Invoices" },
      { slug: "customers", label: "Customers" },
      { slug: "estimates", label: "Estimates" },
      { slug: "sales-orders", label: "Sales orders" },
      { slug: "payments", label: "Payments" },
      { slug: "credit-notes", label: "Credit notes" },
    ],
  },
  debts: {
    title: "Debts",
    description: "Track money owed by customers, money owed to vendors, and debt payments.",
    resources: [
      { slug: "receivables", label: "Receivables" },
      { slug: "payables", label: "Payables" },
      { slug: "payments", label: "Payments" },
    ],
  },
  purchasing: {
    title: "Purchasing & expenses",
    description: "Vendors, purchase orders, receiving, bills, expenses, and approvals.",
    resources: [
      { slug: "bills", label: "Bills" },
      { slug: "vendors", label: "Vendors" },
      { slug: "purchase-orders", label: "Purchase orders" },
      { slug: "receipts", label: "Item receipts" },
      { slug: "expenses", label: "Expenses" },
      { slug: "approvals", label: "Approvals" },
    ],
  },
  banking: {
    title: "Banking & treasury",
    description: "Accounts, transactions, reconciliation, transfers, and cash flow.",
    resources: [
      { slug: "accounts", label: "Accounts" },
      { slug: "transactions", label: "Transactions" },
      { slug: "reconciliation", label: "Reconciliation" },
      { slug: "transfers", label: "Transfers" },
      { slug: "cash-flow", label: "Cash flow" },
    ],
  },
  inventory: {
    title: "Items & inventory",
    description: "Items, stock levels, warehouses, transfers, counts, and assemblies.",
    resources: [
      { slug: "items", label: "Items" },
      { slug: "stock-levels", label: "Stock levels" },
      { slug: "warehouses", label: "Warehouses" },
      { slug: "transfers", label: "Transfers" },
      { slug: "stock-counts", label: "Stock counts" },
      { slug: "assemblies", label: "Assemblies" },
    ],
  },
  accounting: {
    title: "Accounting",
    description: "Accounts, journals, registers, recurring entries, periods, and audit.",
    resources: [
      { slug: "chart-of-accounts", label: "Chart of accounts" },
      { slug: "journal-entries", label: "Journal entries" },
      { slug: "registers", label: "Registers" },
      { slug: "recurring", label: "Recurring" },
      { slug: "fiscal-periods", label: "Fiscal periods" },
      { slug: "audit-log", label: "Audit log" },
    ],
  },
  projects: {
    title: "Projects & job costing",
    description: "Projects, tasks, time, expenses, progress billing, and profitability.",
    resources: [
      { slug: "projects", label: "Projects" },
      { slug: "tasks", label: "Tasks" },
      { slug: "time", label: "Time" },
      { slug: "expenses", label: "Expenses" },
      { slug: "progress-billing", label: "Progress billing" },
      { slug: "profitability", label: "Profitability" },
    ],
  },
  payroll: {
    title: "Payroll & people",
    description: "Pay runs, employees, timesheets, leave, loans, and payroll reports.",
    resources: [
      { slug: "pay-runs", label: "Pay runs" },
      { slug: "employees", label: "Employees" },
      { slug: "timesheets", label: "Timesheets" },
      { slug: "leave", label: "Leave" },
      { slug: "loans", label: "Loans" },
      { slug: "reports", label: "Payroll reports" },
    ],
  },
  reports: {
    title: "Reports & insights",
    description: "Financial, sales, purchasing, inventory, payroll, and custom reports.",
    resources: [
      { slug: "financial", label: "Financial" },
      { slug: "sales", label: "Sales" },
      { slug: "purchasing", label: "Purchasing" },
      { slug: "inventory", label: "Inventory" },
      { slug: "payroll", label: "Payroll" },
      { slug: "custom", label: "Custom" },
    ],
  },
  settings: {
    title: "Company settings",
    description: "Company, branches, users, currencies, taxes, and workflows.",
    resources: [
      { slug: "company", label: "Company" },
      { slug: "branches", label: "Branches" },
      { slug: "users-roles", label: "Users & roles" },
      { slug: "currencies", label: "Currencies" },
      { slug: "taxes", label: "Taxes" },
      { slug: "workflows", label: "Workflows" },
    ],
  },
};

const salesResources: ResourceConfig[] = [
  {
    module: "sales", moduleTitle: "Sales & receivables", slug: "invoices", title: "Invoices",
    description: "Create, send, post, and collect customer invoices.", primaryAction: "New invoice",
    searchPlaceholder: "Search invoice number, customer, PO, or memo",
    columns: ["Invoice", "Customer", "Amount", "Due date"],
    stats: [{label:"Open invoices",value:"$92,750",helper:"46 invoices"},{label:"Overdue",value:"$18,240",helper:"9 invoices"},{label:"Paid this month",value:"$126,840",helper:"+12.8%"},{label:"Average payment",value:"18 days",helper:"2 days faster"}],
    hasLineItems: true, rows: salesRows,
    formSections: [
      { title: "Invoice header", fields: [
        {name:"template",label:"Template",type:"select",options:["Professional invoice","Product invoice","Service invoice","Progress invoice"],required:true,width:"third"},
        {name:"customer",label:"Customer:Job",type:"select",options:["Banaadir Trading Co.","Sahal Distributors","Horn Logistics","Add new customer"],required:true,width:"third"},
        {name:"class",label:"Class",type:"select",options:["Wholesale","Retail","Projects","Services"],width:"third"},
        {name:"invoiceNumber",label:"Invoice no.",type:"text",required:true,width:"third"},
        {name:"invoiceDate",label:"Invoice date",type:"date",required:true,width:"third"},
        {name:"dueDate",label:"Due date",type:"date",required:true,width:"third"},
        {name:"terms",label:"Terms",type:"select",options:["Due on receipt","Net 15","Net 30","Net 60"],width:"third"},
        {name:"poNumber",label:"Customer PO no.",type:"text",width:"third"},
        {name:"salesRep",label:"Sales rep",type:"select",options:["Abdi","Amina","Hassan","Unassigned"],width:"third"},
        {name:"shipDate",label:"Ship date",type:"date",width:"third"},
        {name:"shipVia",label:"Ship via",type:"select",options:["Pickup","Company delivery","Courier","Freight"],width:"third"},
        {name:"fob",label:"FOB",type:"text",width:"third"},
      ]},
      addressFields,
      transactionTotals,
    ],
  },
  {
    module:"sales",moduleTitle:"Sales & receivables",slug:"customers",title:"Customers",
    description:"Manage customer profiles, jobs, contacts, credit, tax, and payment settings.",primaryAction:"New customer",
    searchPlaceholder:"Search customer, company, phone, email, or account number",columns:["Customer","Company","Open balance","Phone"],
    stats:[{label:"Active customers",value:"286",helper:"+14 this month"},{label:"Open balance",value:"$92,750",helper:"46 customers"},{label:"Credit hold",value:"7",helper:"Requires review"},{label:"Average value",value:"$18,640",helper:"Trailing 12 months"}],
    rows:sampleRows("CUS",["Banaadir Trading Co.","Sahal Distributors","Horn Logistics","Dayax Retail","Amaan Services"],["$18,420","$12,250","$7,180","$22,760","$4,940"]),
    formSections:[
      {title:"Customer identity",fields:[
        {name:"customerName",label:"Customer name",type:"text",required:true,width:"half"},{name:"companyName",label:"Company name",type:"text",width:"half"},
        {name:"title",label:"Title",type:"text",width:"third"},{name:"firstName",label:"First name",type:"text",width:"third"},{name:"middleName",label:"Middle name",type:"text",width:"third"},
        {name:"lastName",label:"Last name",type:"text",width:"third"},{name:"suffix",label:"Suffix",type:"text",width:"third"},{name:"jobTitle",label:"Job title",type:"text",width:"third"},
        {name:"email",label:"Primary email",type:"email",required:true,width:"half"},{name:"ccEmail",label:"CC email",type:"email",width:"half"},
        {name:"phone",label:"Main phone",type:"tel",width:"third"},{name:"mobile",label:"Mobile",type:"tel",width:"third"},{name:"fax",label:"Fax",type:"tel",width:"third"},
        {name:"website",label:"Website",type:"text",width:"half"},{name:"accountNumber",label:"Account number",type:"text",width:"half"},
      ]},
      addressFields,
      {title:"Payment, tax & accounting",fields:[
        {name:"terms",label:"Payment terms",type:"select",options:["Due on receipt","Net 15","Net 30","Net 60"],width:"third"},
        {name:"creditLimit",label:"Credit limit",type:"number",width:"third"},{name:"openingBalance",label:"Opening balance",type:"number",width:"third"},
        {name:"balanceAsOf",label:"Balance as of",type:"date",width:"third"},{name:"priceLevel",label:"Price level",type:"select",options:["Standard","Wholesale","Retail","VIP"],width:"third"},
        {name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR","GBP"],width:"third"},
        {name:"taxStatus",label:"Tax status",type:"select",options:["Taxable","Non-taxable","Resale"],width:"third"},{name:"taxId",label:"Tax registration no.",type:"text",width:"third"},
        {name:"taxItem",label:"Preferred tax item",type:"select",options:["Standard tax","Zero rated","Exempt"],width:"third"},
        {name:"preferredPayment",label:"Preferred payment method",type:"select",options:["Bank transfer","Cash","Cheque","EVC Plus","eDahab","Card"],width:"third"},
        {name:"preferredDelivery",label:"Invoice delivery",type:"select",options:["Email","Print","Email and print"],width:"third"},
        {name:"salesRep",label:"Sales rep",type:"select",options:["Abdi","Amina","Hassan"],width:"third"},
        {name:"customerType",label:"Customer type",type:"select",options:["Wholesale","Retail","Corporate","Government","Nonprofit"],width:"third"},
        {name:"notes",label:"Notes",type:"textarea",width:"full"},{name:"inactive",label:"Customer is inactive",type:"checkbox",width:"half"},
      ]},
    ],
  },
  {
    module:"sales",moduleTitle:"Sales & receivables",slug:"estimates",title:"Estimates",
    description:"Prepare quotes, track acceptance, and convert approved estimates.",primaryAction:"New estimate",
    searchPlaceholder:"Search estimate, customer, project, or status",columns:["Estimate","Customer","Amount","Expiration"],
    stats:[{label:"Open estimates",value:"$184,300",helper:"24 estimates"},{label:"Accepted",value:"$96,800",helper:"52.5%"},{label:"Expiring soon",value:"6",helper:"Next 14 days"},{label:"Win rate",value:"61.8%",helper:"+4.2%"}],
    rows:sampleRows("EST",["Hodan Warehouse Build","Banaadir Trading Co.","Dayax Retail","Amaan Services","Sahal Distributors"],["$48,000","$26,500","$18,200","$12,750","$9,400"]),
    hasLineItems:true,formSections:[
      {title:"Estimate header",fields:[
        {name:"customer",label:"Customer:Job",type:"select",options:["Banaadir Trading Co.","Sahal Distributors","Dayax Retail"],required:true,width:"third"},
        {name:"class",label:"Class",type:"select",options:["Wholesale","Retail","Projects","Services"],width:"third"},{name:"template",label:"Template",type:"select",options:["Standard estimate","Proposal","Project quote"],width:"third"},
        {name:"estimateNumber",label:"Estimate no.",type:"text",required:true,width:"third"},{name:"estimateDate",label:"Estimate date",type:"date",required:true,width:"third"},
        {name:"expirationDate",label:"Expiration date",type:"date",width:"third"},{name:"salesRep",label:"Sales rep",type:"select",options:["Abdi","Amina","Hassan"],width:"third"},
        {name:"project",label:"Project/job",type:"text",width:"third"},{name:"customerPo",label:"Customer reference",type:"text",width:"third"},
      ]},addressFields,transactionTotals,
    ],
  },
  {
    module:"sales",moduleTitle:"Sales & receivables",slug:"sales-orders",title:"Sales orders",
    description:"Commit customer orders, allocate stock, and manage fulfillment.",primaryAction:"New sales order",
    searchPlaceholder:"Search order, customer, PO, item, or fulfillment status",columns:["Order","Customer","Amount","Ship date"],
    stats:[{label:"Open orders",value:"$214,650",helper:"38 orders"},{label:"Ready to ship",value:"14",helper:"$68,240"},{label:"Backordered",value:"7",helper:"18 line items"},{label:"Fulfilled MTD",value:"$172,300",helper:"+9.4%"}],
    rows:sampleRows("SO",["Banaadir Trading Co.","Sahal Distributors","Dayax Retail","Horn Logistics","Amaan Services"],["$16,420","$22,250","$8,180","$31,760","$12,940"]),
    hasLineItems:true,formSections:[
      {title:"Order header",fields:[
        {name:"customer",label:"Customer:Job",type:"select",options:["Banaadir Trading Co.","Sahal Distributors","Dayax Retail"],required:true,width:"third"},
        {name:"orderNumber",label:"Sales order no.",type:"text",required:true,width:"third"},{name:"orderDate",label:"Order date",type:"date",required:true,width:"third"},
        {name:"customerPo",label:"Customer PO no.",type:"text",width:"third"},{name:"shipDate",label:"Requested ship date",type:"date",width:"third"},
        {name:"shipVia",label:"Ship via",type:"select",options:["Pickup","Company delivery","Courier","Freight"],width:"third"},
        {name:"terms",label:"Terms",type:"select",options:["Due on receipt","Net 15","Net 30","Net 60"],width:"third"},
        {name:"salesRep",label:"Sales rep",type:"select",options:["Abdi","Amina","Hassan"],width:"third"},{name:"class",label:"Class",type:"select",options:["Wholesale","Retail","Projects"],width:"third"},
        {name:"warehouse",label:"Fulfillment warehouse",type:"select",options:["Bakaaro","Hodan","Wadajir","Main"],required:true,width:"third"},
        {name:"allocation",label:"Inventory allocation",type:"select",options:["Reserve available","Allow backorder","Do not reserve"],width:"third"},
        {name:"fulfillmentStatus",label:"Fulfillment status",type:"select",options:["Open","Picking","Packed","Partially shipped","Shipped"],width:"third"},
      ]},addressFields,transactionTotals,
    ],
  },
  {
    module:"sales",moduleTitle:"Sales & receivables",slug:"payments",title:"Customer payments",
    description:"Receive, deposit, and apply customer payments to open transactions.",primaryAction:"Receive payment",
    searchPlaceholder:"Search receipt, customer, reference, deposit, or payment method",columns:["Receipt","Customer","Amount","Payment date"],
    stats:[{label:"Received MTD",value:"$126,840",helper:"64 payments"},{label:"Undeposited",value:"$14,520",helper:"9 payments"},{label:"Unapplied",value:"$4,860",helper:"5 customers"},{label:"Average receipt",value:"$1,982",helper:"+6.1%"}],
    rows:sampleRows("PMT",["Banaadir Trading Co.","Sahal Distributors","Horn Logistics","Dayax Retail","Amaan Services"],["$8,420","$6,250","$3,180","$12,760","$2,940"]),
    formSections:[
      {title:"Payment details",fields:[
        {name:"customer",label:"Received from",type:"select",options:["Banaadir Trading Co.","Sahal Distributors","Horn Logistics"],required:true,width:"third"},
        {name:"paymentDate",label:"Payment date",type:"date",required:true,width:"third"},{name:"amount",label:"Amount received",type:"number",required:true,width:"third"},
        {name:"paymentMethod",label:"Payment method",type:"select",options:["Bank transfer","Cash","Cheque","EVC Plus","eDahab","Card"],required:true,width:"third"},
        {name:"reference",label:"Reference / cheque no.",type:"text",width:"third"},{name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR","GBP"],required:true,width:"third"},
        {name:"exchangeRate",label:"Exchange rate",type:"number",width:"third"},{name:"depositTo",label:"Deposit to",type:"select",options:["Undeposited funds","Salaam Bank USD","Premier Bank","Cash on hand","EVC Plus"],required:true,width:"third"},
        {name:"class",label:"Class",type:"select",options:["Wholesale","Retail","Projects","Services"],width:"third"},
        {name:"memo",label:"Memo",type:"textarea",width:"full"},
      ]},
      {title:"Apply to open transactions",description:"Choose how the payment should be allocated.",fields:[
        {name:"autoApply",label:"Automatically apply to oldest invoices",type:"checkbox",width:"half"},
        {name:"discountDate",label:"Discount date",type:"date",width:"third"},{name:"discountAmount",label:"Discount amount",type:"number",width:"third"},
        {name:"writeOff",label:"Write-off amount",type:"number",width:"third"},{name:"leaveCredit",label:"Leave unapplied amount as customer credit",type:"checkbox",width:"full"},
      ]},
    ],
  },
  {
    module:"sales",moduleTitle:"Sales & receivables",slug:"credit-notes",title:"Credit notes",
    description:"Issue customer credits, process returns, and apply credits to invoices.",primaryAction:"New credit note",
    searchPlaceholder:"Search credit number, customer, invoice, return, or memo",columns:["Credit","Customer","Amount","Credit date"],
    stats:[{label:"Open credits",value:"$14,860",helper:"18 credits"},{label:"Applied MTD",value:"$9,420",helper:"22 invoices"},{label:"Unapplied",value:"$5,440",helper:"7 customers"},{label:"Returns MTD",value:"$7,180",helper:"1.8% of sales"}],
    rows:sampleRows("CM",["Banaadir Trading Co.","Sahal Distributors","Horn Logistics","Dayax Retail","Amaan Services"],["$1,420","$850","$680","$2,760","$940"]),
    hasLineItems:true,formSections:[
      {title:"Credit note header",fields:[
        {name:"customer",label:"Customer:Job",type:"select",options:["Banaadir Trading Co.","Sahal Distributors","Horn Logistics"],required:true,width:"third"},
        {name:"creditNumber",label:"Credit no.",type:"text",required:true,width:"third"},{name:"creditDate",label:"Credit date",type:"date",required:true,width:"third"},
        {name:"originalInvoice",label:"Original invoice",type:"select",options:["INV-1048","INV-1047","INV-1046","No linked invoice"],width:"third"},
        {name:"reason",label:"Reason",type:"select",options:["Product return","Pricing adjustment","Damaged goods","Service issue","Other"],required:true,width:"third"},
        {name:"returnWarehouse",label:"Return warehouse",type:"select",options:["Bakaaro","Hodan","Wadajir","Main"],width:"third"},
        {name:"salesRep",label:"Sales rep",type:"select",options:["Abdi","Amina","Hassan"],width:"third"},{name:"class",label:"Class",type:"select",options:["Wholesale","Retail","Projects"],width:"third"},
        {name:"handling",label:"Credit handling",type:"select",options:["Retain as available credit","Apply to invoice","Issue refund"],required:true,width:"third"},
      ]},addressFields,transactionTotals,
    ],
  },
];

const commonResourceSpecs: Array<{
  module: string;
  slug: string;
  title: string;
  action: string;
  columns: string[];
  fields: FormField[];
}> = [
  ["debts","receivables","Receivables","New receivable",["Debt","Customer","Original amount","Outstanding","Due date"],[
    {name:"customer",label:"Customer",type:"select",options:["Banaadir Trading Co.","Sahal Distributors","Dayax Retail","Amaan Services"],required:true},
    {name:"reference",label:"Invoice or reference",type:"text",required:true},{name:"debtDate",label:"Debt date",type:"date",required:true},
    {name:"dueDate",label:"Due date",type:"date",required:true},{name:"originalAmount",label:"Original amount",type:"number",required:true},
    {name:"amountPaid",label:"Amount paid",type:"number"},{name:"outstanding",label:"Outstanding balance",type:"number",required:true},
    {name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR"],required:true},
    {name:"terms",label:"Payment terms",type:"select",options:["Due on receipt","Net 15","Net 30","Net 60"]},
    {name:"salesRep",label:"Account owner",type:"text"},{name:"collectionStatus",label:"Collection status",type:"select",options:["Current","Due soon","Overdue","Disputed","Payment plan"]},
    {name:"notes",label:"Collection notes",type:"textarea"}
  ]],
  ["debts","payables","Payables","New payable",["Debt","Vendor","Original amount","Outstanding","Due date"],[
    {name:"vendor",label:"Vendor",type:"select",options:["Horn Logistics","Som Petroleum","Mogadishu Imports","Juba Office Supply"],required:true},
    {name:"reference",label:"Bill or reference",type:"text",required:true},{name:"debtDate",label:"Debt date",type:"date",required:true},
    {name:"dueDate",label:"Due date",type:"date",required:true},{name:"originalAmount",label:"Original amount",type:"number",required:true},
    {name:"amountPaid",label:"Amount paid",type:"number"},{name:"outstanding",label:"Outstanding balance",type:"number",required:true},
    {name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR"],required:true},
    {name:"terms",label:"Payment terms",type:"select",options:["Due on receipt","Net 15","Net 30","Net 60"]},
    {name:"expenseAccount",label:"Expense or asset account",type:"text"},{name:"paymentPriority",label:"Payment priority",type:"select",options:["Normal","High","Critical"]},
    {name:"notes",label:"Payment notes",type:"textarea"}
  ]],
  ["debts","payments","Debt payments","Record payment",["Payment","Party","Type","Amount","Payment date"],[
    {name:"partyType",label:"Payment direction",type:"select",options:["Customer receipt","Vendor payment"],required:true},
    {name:"party",label:"Customer or vendor",type:"text",required:true},{name:"debtReference",label:"Debt reference",type:"text",required:true},
    {name:"paymentDate",label:"Payment date",type:"date",required:true},{name:"amount",label:"Payment amount",type:"number",required:true},
    {name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR"],required:true},
    {name:"paymentMethod",label:"Payment method",type:"select",options:["Cash","Bank transfer","Cheque","Card","Mobile money"],required:true},
    {name:"account",label:"Deposit or payment account",type:"select",options:["Salaam Bank","Premier Bank","EVC Plus","Cash on hand"],required:true},
    {name:"reference",label:"Payment reference",type:"text"},{name:"applyTo",label:"Apply to invoice or bill",type:"text"},
    {name:"discount",label:"Discount or write-off",type:"number"},{name:"memo",label:"Payment memo",type:"textarea"}
  ]],
  ["purchasing","bills","Vendor bills","New bill",["Bill","Vendor","Amount","Due date"],[
    {name:"vendor",label:"Vendor",type:"select",options:["Horn Logistics","Som Petroleum","Mogadishu Imports"],required:true},{name:"billNumber",label:"Vendor bill no.",type:"text",required:true},{name:"billDate",label:"Bill date",type:"date",required:true},{name:"dueDate",label:"Due date",type:"date",required:true},{name:"terms",label:"Terms",type:"select",options:["Due on receipt","Net 15","Net 30","Net 60"]},{name:"apAccount",label:"A/P account",type:"select",options:["Accounts payable","Trade payables"]},{name:"expenseAccount",label:"Expense or inventory account",type:"select",options:["Inventory asset","Cost of goods sold","Office expense","Freight"]},{name:"amount",label:"Amount",type:"number",required:true},{name:"tax",label:"Tax item",type:"select",options:["Standard tax","Non-taxable","Zero rated"]},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["purchasing","vendors","Vendors","New vendor",["Vendor","Company","Open balance","Phone"],[
    {name:"vendorName",label:"Vendor name",type:"text",required:true},{name:"companyName",label:"Company name",type:"text"},{name:"contact",label:"Primary contact",type:"text"},{name:"email",label:"Email",type:"email"},{name:"phone",label:"Phone",type:"tel"},{name:"taxId",label:"Tax ID",type:"text"},{name:"accountNumber",label:"Account number",type:"text"},{name:"terms",label:"Payment terms",type:"select",options:["Due on receipt","Net 15","Net 30","Net 60"]},{name:"creditLimit",label:"Credit limit",type:"number"},{name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR"]},{name:"address",label:"Billing address",type:"textarea"},{name:"notes",label:"Notes",type:"textarea"}
  ]],
  ["purchasing","purchase-orders","Purchase orders","New purchase order",["PO","Vendor","Amount","Expected"],[
    {name:"vendor",label:"Vendor",type:"select",options:["Horn Logistics","Som Petroleum","Mogadishu Imports"],required:true},{name:"poNumber",label:"PO number",type:"text",required:true},{name:"poDate",label:"PO date",type:"date",required:true},{name:"expectedDate",label:"Expected date",type:"date"},{name:"shipTo",label:"Ship to warehouse",type:"select",options:["Bakaaro","Hodan","Wadajir","Main"]},{name:"buyer",label:"Buyer",type:"text"},{name:"terms",label:"Terms",type:"select",options:["Net 15","Net 30","Net 60"]},{name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR"]},{name:"vendorMessage",label:"Vendor message",type:"textarea"},{name:"memo",label:"Internal memo",type:"textarea"}
  ]],
  ["purchasing","receipts","Item receipts","Receive items",["Receipt","Vendor","PO","Received"],[
    {name:"vendor",label:"Vendor",type:"select",options:["Horn Logistics","Som Petroleum","Mogadishu Imports"],required:true},{name:"purchaseOrder",label:"Purchase order",type:"text",required:true},{name:"receiptNumber",label:"Receipt number",type:"text"},{name:"receiptDate",label:"Receipt date",type:"date",required:true},{name:"warehouse",label:"Receiving warehouse",type:"select",options:["Bakaaro","Hodan","Wadajir","Main"]},{name:"carrier",label:"Carrier",type:"text"},{name:"tracking",label:"Tracking number",type:"text"},{name:"packingSlip",label:"Packing slip",type:"text"},{name:"receivedBy",label:"Received by",type:"text"},{name:"notes",label:"Receiving notes",type:"textarea"}
  ]],
  ["purchasing","expenses","Expenses","Record expense",["Expense","Payee","Amount","Date"],[
    {name:"payee",label:"Payee",type:"text",required:true},{name:"paymentAccount",label:"Payment account",type:"select",options:["Cash on hand","Salaam Bank","Premier Bank","EVC Plus"],required:true},{name:"paymentDate",label:"Payment date",type:"date",required:true},{name:"paymentMethod",label:"Payment method",type:"select",options:["Cash","Cheque","Bank transfer","EVC Plus","Card"]},{name:"reference",label:"Reference",type:"text"},{name:"expenseAccount",label:"Expense account",type:"select",options:["Office expense","Travel","Utilities","Repairs","Other"],required:true},{name:"amount",label:"Amount",type:"number",required:true},{name:"tax",label:"Tax",type:"select",options:["Non-taxable","Standard tax"]},{name:"class",label:"Class",type:"text"},{name:"project",label:"Customer/project",type:"text"},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["purchasing","approvals","Purchase approvals","New approval rule",["Request","Type","Amount","Submitted"],[
    {name:"workflow",label:"Workflow name",type:"text",required:true},{name:"documentType",label:"Document type",type:"select",options:["Purchase order","Bill","Expense","Vendor credit"]},{name:"minimumAmount",label:"Minimum amount",type:"number"},{name:"maximumAmount",label:"Maximum amount",type:"number"},{name:"branch",label:"Branch",type:"select",options:["All branches","Main","Hodan","Bakaaro"]},{name:"requester",label:"Requester role",type:"text"},{name:"approver1",label:"First approver",type:"text",required:true},{name:"approver2",label:"Second approver",type:"text"},{name:"deadlineHours",label:"Approval deadline hours",type:"number"},{name:"active",label:"Active workflow",type:"checkbox"}
  ]],
  ["banking","accounts","Bank & cash accounts","New account",["Account","Type","Balance","Currency"],[
    {name:"accountName",label:"Account name",type:"text",required:true},{name:"accountType",label:"Account type",type:"select",options:["Bank","Cash","Mobile money","Credit card"]},{name:"bankName",label:"Bank/provider",type:"text"},{name:"accountNumber",label:"Account number",type:"text"},{name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR"],required:true},{name:"openingBalance",label:"Opening balance",type:"number"},{name:"asOf",label:"Balance as of",type:"date"},{name:"glAccount",label:"General ledger account",type:"text"},{name:"branch",label:"Branch",type:"text"},{name:"reconcile",label:"Enable reconciliation",type:"checkbox"}
  ]],
  ["banking","transactions","Bank transactions","Record transaction",["Transaction","Account","Amount","Date"],[
    {name:"account",label:"Account",type:"select",options:["Salaam Bank","Premier Bank","EVC Plus","Cash on hand"],required:true},{name:"type",label:"Transaction type",type:"select",options:["Deposit","Withdrawal","Cheque","Fee","Interest"],required:true},{name:"date",label:"Date",type:"date",required:true},{name:"payee",label:"Payee/payer",type:"text"},{name:"reference",label:"Reference",type:"text"},{name:"category",label:"Category account",type:"text"},{name:"amount",label:"Amount",type:"number",required:true},{name:"class",label:"Class",type:"text"},{name:"memo",label:"Memo",type:"textarea"},{name:"cleared",label:"Cleared",type:"checkbox"}
  ]],
  ["banking","reconciliation","Reconciliations","Start reconciliation",["Statement","Account","Difference","Statement date"],[
    {name:"account",label:"Account",type:"select",options:["Salaam Bank","Premier Bank","EVC Plus"],required:true},{name:"statementDate",label:"Statement date",type:"date",required:true},{name:"beginningBalance",label:"Beginning balance",type:"number",required:true},{name:"endingBalance",label:"Ending balance",type:"number",required:true},{name:"serviceCharge",label:"Service charge",type:"number"},{name:"chargeDate",label:"Charge date",type:"date"},{name:"chargeAccount",label:"Charge account",type:"text"},{name:"interestEarned",label:"Interest earned",type:"number"},{name:"interestDate",label:"Interest date",type:"date"},{name:"interestAccount",label:"Interest account",type:"text"}
  ]],
  ["banking","transfers","Account transfers","New transfer",["Transfer","From","Amount","Date"],[
    {name:"fromAccount",label:"Transfer funds from",type:"select",options:["Salaam Bank","Premier Bank","EVC Plus","Cash"],required:true},{name:"toAccount",label:"Transfer funds to",type:"select",options:["Salaam Bank","Premier Bank","EVC Plus","Cash"],required:true},{name:"date",label:"Transfer date",type:"date",required:true},{name:"amount",label:"Transfer amount",type:"number",required:true},{name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR"]},{name:"exchangeRate",label:"Exchange rate",type:"number"},{name:"reference",label:"Reference",type:"text"},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["banking","cash-flow","Cash flow forecasts","New forecast",["Forecast","Period","Opening cash","Closing cash"],[
    {name:"forecastName",label:"Forecast name",type:"text",required:true},{name:"startDate",label:"Start date",type:"date",required:true},{name:"endDate",label:"End date",type:"date",required:true},{name:"accounts",label:"Included accounts",type:"text"},{name:"scenario",label:"Scenario",type:"select",options:["Base","Optimistic","Conservative"]},{name:"openingCash",label:"Opening cash",type:"number"},{name:"expectedInflows",label:"Expected inflows",type:"number"},{name:"expectedOutflows",label:"Expected outflows",type:"number"},{name:"notes",label:"Assumptions",type:"textarea"}
  ]],
  ["inventory","items","Items & services","New item",["SKU","Item","On hand","Sales price"],[
    {name:"type",label:"Item type",type:"select",options:["Inventory part","Non-inventory part","Service","Inventory assembly","Other charge","Subtotal","Discount","Payment","Sales tax"],required:true},{name:"name",label:"Item name/number",type:"text",required:true},{name:"sku",label:"SKU",type:"text"},{name:"category",label:"Category",type:"text"},{name:"unit",label:"Unit of measure",type:"select",options:["Each","Box","Kg","Liter","Meter","Hour"]},{name:"barcode",label:"Barcode",type:"text"},{name:"salesDescription",label:"Sales description",type:"textarea"},{name:"salesPrice",label:"Sales price",type:"number"},{name:"incomeAccount",label:"Income account",type:"text"},{name:"purchaseDescription",label:"Purchase description",type:"textarea"},{name:"purchaseCost",label:"Purchase cost",type:"number"},{name:"cogsAccount",label:"COGS account",type:"text"},{name:"assetAccount",label:"Inventory asset account",type:"text"},{name:"preferredVendor",label:"Preferred vendor",type:"text"},{name:"reorderPoint",label:"Reorder point",type:"number"},{name:"openingQuantity",label:"Quantity on hand",type:"number"},{name:"asOf",label:"As of date",type:"date"},{name:"taxCode",label:"Tax code",type:"text"},{name:"serialTracking",label:"Track serial numbers",type:"checkbox"},{name:"lotTracking",label:"Track lot numbers",type:"checkbox"}
  ]],
  ["inventory","stock-levels","Stock levels","Adjust quantity",["SKU","Item","On hand","Available"],[
    {name:"adjustmentDate",label:"Adjustment date",type:"date",required:true},{name:"adjustmentAccount",label:"Adjustment account",type:"text",required:true},{name:"reference",label:"Reference",type:"text"},{name:"warehouse",label:"Warehouse",type:"select",options:["Bakaaro","Hodan","Wadajir","Main"]},{name:"item",label:"Item",type:"text",required:true},{name:"currentQuantity",label:"Current quantity",type:"number"},{name:"newQuantity",label:"New quantity",type:"number",required:true},{name:"quantityDifference",label:"Quantity difference",type:"number"},{name:"valueAdjustment",label:"Value adjustment",type:"number"},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["inventory","warehouses","Warehouses & bins","New warehouse",["Warehouse","Code","Items","Manager"],[
    {name:"name",label:"Warehouse name",type:"text",required:true},{name:"code",label:"Warehouse code",type:"text",required:true},{name:"branch",label:"Branch",type:"text"},{name:"manager",label:"Manager",type:"text"},{name:"phone",label:"Phone",type:"tel"},{name:"email",label:"Email",type:"email"},{name:"address",label:"Address",type:"textarea"},{name:"defaultReceiving",label:"Default receiving site",type:"checkbox"},{name:"defaultShipping",label:"Default shipping site",type:"checkbox"},{name:"binTracking",label:"Enable bin tracking",type:"checkbox"}
  ]],
  ["inventory","transfers","Inventory transfers","New transfer",["Transfer","From","To","Date"],[
    {name:"transferNumber",label:"Transfer number",type:"text",required:true},{name:"date",label:"Transfer date",type:"date",required:true},{name:"fromWarehouse",label:"From warehouse",type:"select",options:["Bakaaro","Hodan","Wadajir","Main"],required:true},{name:"toWarehouse",label:"To warehouse",type:"select",options:["Bakaaro","Hodan","Wadajir","Main"],required:true},{name:"item",label:"Item",type:"text",required:true},{name:"quantity",label:"Quantity",type:"number",required:true},{name:"unit",label:"Unit",type:"text"},{name:"lotSerial",label:"Lot/serial",type:"text"},{name:"carrier",label:"Carrier",type:"text"},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["inventory","stock-counts","Stock counts","New stock count",["Count","Warehouse","Variance","Count date"],[
    {name:"countName",label:"Count name",type:"text",required:true},{name:"warehouse",label:"Warehouse",type:"select",options:["Bakaaro","Hodan","Wadajir","Main"],required:true},{name:"countDate",label:"Count date",type:"date",required:true},{name:"category",label:"Item category",type:"text"},{name:"bin",label:"Bin range",type:"text"},{name:"assignedTo",label:"Assigned to",type:"text"},{name:"freezeTransactions",label:"Freeze stock movements",type:"checkbox"},{name:"blindCount",label:"Hide expected quantities",type:"checkbox"},{name:"notes",label:"Count instructions",type:"textarea"}
  ]],
  ["inventory","assemblies","Inventory assemblies","Build assembly",["Assembly","Item","Quantity","Build date"],[
    {name:"assemblyItem",label:"Assembly item",type:"text",required:true},{name:"buildNumber",label:"Build reference",type:"text",required:true},{name:"buildDate",label:"Build date",type:"date",required:true},{name:"warehouse",label:"Warehouse",type:"select",options:["Bakaaro","Hodan","Wadajir","Main"]},{name:"quantity",label:"Quantity to build",type:"number",required:true},{name:"available",label:"Maximum buildable",type:"number"},{name:"lotNumber",label:"Lot number",type:"text"},{name:"expirationDate",label:"Expiration date",type:"date"},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["accounting","chart-of-accounts","Chart of accounts","New account",["Account","Type","Balance","Currency"],[
    {name:"accountNumber",label:"Account number",type:"text",required:true},{name:"accountName",label:"Account name",type:"text",required:true},{name:"accountType",label:"Account type",type:"select",options:["Bank","Accounts receivable","Other current asset","Fixed asset","Accounts payable","Credit card","Other current liability","Long-term liability","Equity","Income","Cost of goods sold","Expense","Other income","Other expense"],required:true},{name:"subaccountOf",label:"Subaccount of",type:"text"},{name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR"]},{name:"openingBalance",label:"Opening balance",type:"number"},{name:"asOf",label:"As of date",type:"date"},{name:"taxLine",label:"Tax line mapping",type:"text"},{name:"description",label:"Description",type:"textarea"},{name:"inactive",label:"Inactive",type:"checkbox"}
  ]],
  ["accounting","journal-entries","Journal entries","New journal entry",["Journal","Description","Amount","Date"],[
    {name:"journalNumber",label:"Journal number",type:"text",required:true},{name:"date",label:"Journal date",type:"date",required:true},{name:"reference",label:"Reference",type:"text"},{name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR"]},{name:"exchangeRate",label:"Exchange rate",type:"number"},{name:"debitAccount",label:"Debit account",type:"text",required:true},{name:"debitAmount",label:"Debit amount",type:"number",required:true},{name:"creditAccount",label:"Credit account",type:"text",required:true},{name:"creditAmount",label:"Credit amount",type:"number",required:true},{name:"class",label:"Class",type:"text"},{name:"branch",label:"Branch",type:"text"},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["accounting","registers","Account registers","Add register transaction",["Transaction","Account","Amount","Date"],[
    {name:"account",label:"Register account",type:"text",required:true},{name:"transactionType",label:"Transaction type",type:"select",options:["Cheque","Deposit","Transfer","Journal","Payment"]},{name:"date",label:"Date",type:"date",required:true},{name:"number",label:"Number",type:"text"},{name:"payee",label:"Payee",type:"text"},{name:"payment",label:"Payment",type:"number"},{name:"deposit",label:"Deposit",type:"number"},{name:"cleared",label:"Cleared",type:"checkbox"},{name:"accountSplit",label:"Account/split",type:"text"},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["accounting","recurring","Recurring transactions","New recurring template",["Template","Type","Frequency","Next date"],[
    {name:"templateName",label:"Template name",type:"text",required:true},{name:"transactionType",label:"Transaction type",type:"select",options:["Invoice","Bill","Journal entry","Cheque","Expense"]},{name:"scheduleType",label:"Schedule type",type:"select",options:["Scheduled","Reminder","Unscheduled"]},{name:"frequency",label:"Frequency",type:"select",options:["Daily","Weekly","Monthly","Quarterly","Yearly"]},{name:"nextDate",label:"Next date",type:"date"},{name:"endDate",label:"End date",type:"date"},{name:"daysInAdvance",label:"Create days in advance",type:"number"},{name:"amount",label:"Amount",type:"number"},{name:"active",label:"Active",type:"checkbox"},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["accounting","fiscal-periods","Fiscal periods","New fiscal period",["Period","Start","End","Status"],[
    {name:"name",label:"Period name",type:"text",required:true},{name:"fiscalYear",label:"Fiscal year",type:"number",required:true},{name:"startDate",label:"Start date",type:"date",required:true},{name:"endDate",label:"End date",type:"date",required:true},{name:"status",label:"Status",type:"select",options:["Open","Soft closed","Closed"]},{name:"closingDate",label:"Closing date",type:"date"},{name:"closingPassword",label:"Closing password",type:"text"},{name:"allowAdjustments",label:"Allow adjustment journals",type:"checkbox"},{name:"notes",label:"Notes",type:"textarea"}
  ]],
  ["accounting","audit-log","Audit log","Export audit log",["Event","User","Entity","Date"],[
    {name:"dateFrom",label:"Date from",type:"date"},{name:"dateTo",label:"Date to",type:"date"},{name:"user",label:"User",type:"text"},{name:"action",label:"Action",type:"select",options:["Create","Edit","Delete","Post","Approve","Login"]},{name:"entityType",label:"Entity type",type:"text"},{name:"entityId",label:"Entity ID",type:"text"},{name:"branch",label:"Branch",type:"text"},{name:"ipAddress",label:"IP address",type:"text"}
  ]],
  ["projects","projects","Projects","New project",["Project","Customer","Budget","Due date"],[
    {name:"projectName",label:"Project name",type:"text",required:true},{name:"customer",label:"Customer",type:"text",required:true},{name:"projectCode",label:"Project code",type:"text"},{name:"manager",label:"Project manager",type:"text"},{name:"startDate",label:"Start date",type:"date"},{name:"endDate",label:"End date",type:"date"},{name:"contractValue",label:"Contract value",type:"number"},{name:"budget",label:"Cost budget",type:"number"},{name:"billingMethod",label:"Billing method",type:"select",options:["Fixed price","Time and materials","Progress billing","Cost plus"]},{name:"status",label:"Status",type:"select",options:["Planning","Active","On hold","Completed"]},{name:"description",label:"Description",type:"textarea"}
  ]],
  ["projects","tasks","Project tasks","New task",["Task","Project","Assignee","Due date"],[
    {name:"taskName",label:"Task name",type:"text",required:true},{name:"project",label:"Project",type:"text",required:true},{name:"assignee",label:"Assignee",type:"text"},{name:"startDate",label:"Start date",type:"date"},{name:"dueDate",label:"Due date",type:"date"},{name:"priority",label:"Priority",type:"select",options:["Low","Normal","High","Critical"]},{name:"estimatedHours",label:"Estimated hours",type:"number"},{name:"percentComplete",label:"Percent complete",type:"number"},{name:"billable",label:"Billable",type:"checkbox"},{name:"description",label:"Description",type:"textarea"}
  ]],
  ["projects","time","Project time","New time entry",["Entry","Employee","Hours","Date"],[
    {name:"employee",label:"Employee",type:"text",required:true},{name:"date",label:"Date",type:"date",required:true},{name:"project",label:"Customer/project",type:"text",required:true},{name:"serviceItem",label:"Service item",type:"text"},{name:"startTime",label:"Start time",type:"text"},{name:"endTime",label:"End time",type:"text"},{name:"breakMinutes",label:"Break minutes",type:"number"},{name:"hours",label:"Hours",type:"number",required:true},{name:"billable",label:"Billable",type:"checkbox"},{name:"billingRate",label:"Billing rate",type:"number"},{name:"notes",label:"Notes",type:"textarea"}
  ]],
  ["projects","expenses","Project expenses","New project expense",["Expense","Project","Amount","Date"],[
    {name:"project",label:"Project",type:"text",required:true},{name:"vendor",label:"Vendor/payee",type:"text"},{name:"date",label:"Expense date",type:"date",required:true},{name:"category",label:"Expense category",type:"text"},{name:"amount",label:"Amount",type:"number",required:true},{name:"markup",label:"Markup %",type:"number"},{name:"billable",label:"Billable to customer",type:"checkbox"},{name:"invoiceStatus",label:"Billing status",type:"select",options:["Unbilled","Invoiced","Non-billable"]},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["projects","progress-billing","Progress billing","New progress invoice",["Invoice","Project","Progress","Amount"],[
    {name:"project",label:"Project",type:"text",required:true},{name:"estimate",label:"Estimate/contract",type:"text"},{name:"invoiceDate",label:"Invoice date",type:"date",required:true},{name:"billingBasis",label:"Billing basis",type:"select",options:["Percentage complete","Custom amount","Milestone"]},{name:"previouslyBilled",label:"Previously billed",type:"number"},{name:"currentPercent",label:"Current completion %",type:"number"},{name:"currentAmount",label:"Current billing amount",type:"number"},{name:"retainage",label:"Retainage %",type:"number"},{name:"memo",label:"Memo",type:"textarea"}
  ]],
  ["projects","profitability","Project profitability","New analysis",["Project","Revenue","Cost","Margin"],[
    {name:"project",label:"Project",type:"text",required:true},{name:"dateFrom",label:"Date from",type:"date"},{name:"dateTo",label:"Date to",type:"date"},{name:"includeCommitted",label:"Include committed costs",type:"checkbox"},{name:"includeUnbilled",label:"Include unbilled revenue",type:"checkbox"},{name:"costBasis",label:"Cost basis",type:"select",options:["Actual cost","Standard cost","Landed cost"]},{name:"groupBy",label:"Group by",type:"select",options:["Account","Item","Vendor","Employee","Phase"]},{name:"notes",label:"Analysis notes",type:"textarea"}
  ]],
  ["payroll","pay-runs","Pay runs","Start pay run",["Pay run","Period","Employees","Net pay"],[
    {name:"paySchedule",label:"Pay schedule",type:"select",options:["Monthly","Biweekly","Weekly"],required:true},{name:"periodStart",label:"Period start",type:"date",required:true},{name:"periodEnd",label:"Period end",type:"date",required:true},{name:"paymentDate",label:"Payment date",type:"date",required:true},{name:"bankAccount",label:"Payroll bank account",type:"text"},{name:"department",label:"Department",type:"text"},{name:"includeBonuses",label:"Include approved bonuses",type:"checkbox"},{name:"includeOvertime",label:"Include overtime",type:"checkbox"},{name:"memo",label:"Payroll memo",type:"textarea"}
  ]],
  ["payroll","employees","Employees","New employee",["Employee","Department","Net pay","Status"],[
    {name:"employeeId",label:"Employee ID",type:"text",required:true},{name:"firstName",label:"First name",type:"text",required:true},{name:"middleName",label:"Middle name",type:"text"},{name:"lastName",label:"Last name",type:"text",required:true},{name:"email",label:"Work email",type:"email"},{name:"phone",label:"Phone",type:"tel"},{name:"dateOfBirth",label:"Date of birth",type:"date"},{name:"hireDate",label:"Hire date",type:"date"},{name:"department",label:"Department",type:"text"},{name:"position",label:"Position",type:"text"},{name:"manager",label:"Manager",type:"text"},{name:"payType",label:"Pay type",type:"select",options:["Salary","Hourly"]},{name:"salary",label:"Salary/rate",type:"number"},{name:"paySchedule",label:"Pay schedule",type:"select",options:["Monthly","Biweekly","Weekly"]},{name:"bankName",label:"Bank name",type:"text"},{name:"bankAccount",label:"Bank account",type:"text"},{name:"taxId",label:"Tax/ID number",type:"text"},{name:"address",label:"Address",type:"textarea"},{name:"active",label:"Active employee",type:"checkbox"}
  ]],
  ["payroll","timesheets","Timesheets","New timesheet",["Timesheet","Employee","Hours","Week"],[
    {name:"employee",label:"Employee",type:"text",required:true},{name:"weekStart",label:"Week starting",type:"date",required:true},{name:"project",label:"Project/job",type:"text"},{name:"serviceItem",label:"Service item",type:"text"},{name:"regularHours",label:"Regular hours",type:"number"},{name:"overtimeHours",label:"Overtime hours",type:"number"},{name:"leaveHours",label:"Leave hours",type:"number"},{name:"billable",label:"Billable",type:"checkbox"},{name:"notes",label:"Notes",type:"textarea"}
  ]],
  ["payroll","leave","Leave requests","New leave request",["Request","Employee","Days","Start date"],[
    {name:"employee",label:"Employee",type:"text",required:true},{name:"leaveType",label:"Leave type",type:"select",options:["Annual","Sick","Unpaid","Maternity","Paternity","Compassionate"],required:true},{name:"startDate",label:"Start date",type:"date",required:true},{name:"endDate",label:"End date",type:"date",required:true},{name:"days",label:"Days",type:"number"},{name:"halfDay",label:"Half day",type:"checkbox"},{name:"coveringEmployee",label:"Covering employee",type:"text"},{name:"reason",label:"Reason",type:"textarea"},{name:"attachmentReference",label:"Attachment reference",type:"text"}
  ]],
  ["payroll","loans","Employee loans","New employee loan",["Loan","Employee","Balance","Deduction"],[
    {name:"employee",label:"Employee",type:"text",required:true},{name:"loanType",label:"Loan type",type:"select",options:["Salary advance","Employee loan","Emergency loan"]},{name:"principal",label:"Principal amount",type:"number",required:true},{name:"interestRate",label:"Interest rate %",type:"number"},{name:"startDate",label:"Start date",type:"date"},{name:"installments",label:"Number of installments",type:"number"},{name:"deductionAmount",label:"Deduction per pay run",type:"number"},{name:"account",label:"Loan receivable account",type:"text"},{name:"notes",label:"Notes",type:"textarea"}
  ]],
  ["payroll","reports","Payroll reports","Create payroll report",["Report","Period","Employees","Generated"],[
    {name:"reportType",label:"Report type",type:"select",options:["Payroll summary","Employee earnings","Deductions","Payroll liabilities","Leave balances","Loan balances"],required:true},{name:"dateFrom",label:"Date from",type:"date"},{name:"dateTo",label:"Date to",type:"date"},{name:"department",label:"Department",type:"text"},{name:"employee",label:"Employee",type:"text"},{name:"groupBy",label:"Group by",type:"select",options:["Employee","Department","Pay item"]},{name:"includeInactive",label:"Include inactive employees",type:"checkbox"},{name:"format",label:"Export format",type:"select",options:["PDF","Excel","CSV"]}
  ]],
  ["settings","company","Company profile","Edit company",["Company","Legal name","Currency","Fiscal year"],[
    {name:"legalName",label:"Legal company name",type:"text",required:true},{name:"tradingName",label:"Trading name",type:"text"},{name:"registrationNumber",label:"Registration number",type:"text"},{name:"taxId",label:"Tax ID",type:"text"},{name:"industry",label:"Industry",type:"text"},{name:"fiscalYearStart",label:"Fiscal year starts",type:"date"},{name:"functionalCurrency",label:"Functional currency",type:"select",options:["USD","SOS","EUR"]},{name:"email",label:"Company email",type:"email"},{name:"phone",label:"Company phone",type:"tel"},{name:"website",label:"Website",type:"text"},{name:"address",label:"Registered address",type:"textarea"},{name:"logoReference",label:"Logo file reference",type:"text"}
  ]],
  ["settings","branches","Branches","New branch",["Branch","Code","Manager","Currency"],[
    {name:"branchName",label:"Branch name",type:"text",required:true},{name:"branchCode",label:"Branch code",type:"text",required:true},{name:"legalEntity",label:"Legal entity",type:"text"},{name:"manager",label:"Branch manager",type:"text"},{name:"phone",label:"Phone",type:"tel"},{name:"email",label:"Email",type:"email"},{name:"currency",label:"Default currency",type:"select",options:["USD","SOS","EUR"]},{name:"timezone",label:"Timezone",type:"text"},{name:"address",label:"Address",type:"textarea"},{name:"active",label:"Active branch",type:"checkbox"}
  ]],
  ["settings","users-roles","Users & roles","Invite user",["User","Role","Branch","Last active"],[
    {name:"fullName",label:"Full name",type:"text",required:true},{name:"email",label:"Email",type:"email",required:true},{name:"role",label:"Role",type:"select",options:["Administrator","Finance manager","Accountant","Sales manager","Purchasing manager","Warehouse manager","Payroll manager","Viewer"]},{name:"companies",label:"Companies",type:"text"},{name:"branches",label:"Branches",type:"text"},{name:"warehouses",label:"Warehouses",type:"text"},{name:"approvalLimit",label:"Approval limit",type:"number"},{name:"dataAccess",label:"Data-level access",type:"select",options:["All data","Assigned customers","Assigned vendors","Own transactions"]},{name:"twoFactor",label:"Require two-factor authentication",type:"checkbox"},{name:"active",label:"Active user",type:"checkbox"}
  ]],
  ["settings","currencies","Currencies","Add currency",["Currency","Code","Rate","Updated"],[
    {name:"currencyName",label:"Currency name",type:"text",required:true},{name:"code",label:"ISO code",type:"text",required:true},{name:"symbol",label:"Symbol",type:"text"},{name:"exchangeRate",label:"Exchange rate",type:"number",required:true},{name:"rateDate",label:"Rate date",type:"date"},{name:"rateSource",label:"Rate source",type:"text"},{name:"decimalPlaces",label:"Decimal places",type:"number"},{name:"baseCurrency",label:"Base currency",type:"checkbox"},{name:"active",label:"Active",type:"checkbox"}
  ]],
  ["settings","taxes","Tax settings","New tax code",["Tax","Code","Rate","Authority"],[
    {name:"taxName",label:"Tax name",type:"text",required:true},{name:"taxCode",label:"Tax code",type:"text",required:true},{name:"rate",label:"Rate %",type:"number",required:true},{name:"taxAuthority",label:"Tax authority",type:"text"},{name:"payableAccount",label:"Tax payable account",type:"text"},{name:"expenseAccount",label:"Tax expense account",type:"text"},{name:"effectiveDate",label:"Effective date",type:"date"},{name:"filingFrequency",label:"Filing frequency",type:"select",options:["Monthly","Quarterly","Yearly"]},{name:"inclusive",label:"Prices include tax",type:"checkbox"},{name:"active",label:"Active",type:"checkbox"}
  ]],
  ["settings","workflows","Approval workflows","New workflow",["Workflow","Document","Threshold","Approvers"],[
    {name:"workflowName",label:"Workflow name",type:"text",required:true},{name:"documentType",label:"Document type",type:"select",options:["Invoice","Estimate","Sales order","Purchase order","Bill","Expense","Journal entry","Payment"]},{name:"minimumAmount",label:"Minimum amount",type:"number"},{name:"maximumAmount",label:"Maximum amount",type:"number"},{name:"branch",label:"Branch",type:"text"},{name:"role",label:"Requester role",type:"text"},{name:"approver1",label:"First approver",type:"text",required:true},{name:"approver2",label:"Second approver",type:"text"},{name:"approver3",label:"Final approver",type:"text"},{name:"deadline",label:"Deadline hours",type:"number"},{name:"active",label:"Active workflow",type:"checkbox"}
  ]],
].map(([module, slug, title, action, columns, fields]) => ({ module, slug, title, action, columns, fields })) as Array<{
  module: string; slug: string; title: string; action: string; columns: string[]; fields: FormField[];
}>;

const reportSlugs = moduleDefinitions.reports.resources.map((resource) => resource.slug);
for (const slug of reportSlugs) {
  commonResourceSpecs.push({
    module:"reports",slug,title:`${slug[0].toUpperCase()}${slug.slice(1)} reports`,action:slug==="custom"?"Create custom report":"Run report",
    columns:["Report","Category","Last run","Owner"],
    fields:[
      {name:"reportName",label:"Report name",type:"text",required:true},{name:"dateFrom",label:"Date from",type:"date"},{name:"dateTo",label:"Date to",type:"date"},
      {name:"basis",label:"Accounting basis",type:"select",options:["Accrual","Cash"]},{name:"company",label:"Company",type:"text"},{name:"branch",label:"Branch",type:"text"},
      {name:"currency",label:"Currency",type:"select",options:["USD","SOS","EUR"]},{name:"groupBy",label:"Group by",type:"text"},{name:"columns",label:"Displayed columns",type:"textarea"},
      {name:"comparison",label:"Comparison period",type:"select",options:["None","Previous period","Previous year","Budget"]},{name:"schedule",label:"Schedule email delivery",type:"checkbox"},
    ],
  });
}

export const resourceConfigs: Record<string, ResourceConfig> = {};

for (const resource of salesResources) {
  resourceConfigs[`${resource.module}/${resource.slug}`] = resource;
}

for (const spec of commonResourceSpecs) {
  const moduleDefinition = moduleDefinitions[spec.module];
  resourceConfigs[`${spec.module}/${spec.slug}`] = {
    module: spec.module,
    moduleTitle: moduleDefinition.title,
    slug: spec.slug,
    title: spec.title,
    description: `Manage ${spec.title.toLowerCase()} with dedicated fields, controls, and audit-ready records.`,
    primaryAction: spec.action,
    searchPlaceholder: `Search ${spec.title.toLowerCase()}`,
    columns: spec.columns,
    stats: [
      { label: `Total ${spec.title.toLowerCase()}`, value: "128", helper: "+8 this month" },
      { label: "Active", value: "96", helper: "75% of total" },
      { label: "Pending review", value: "12", helper: "Needs attention" },
      { label: "Updated today", value: "18", helper: "Across all branches" },
    ],
    formSections: [{ title: `${spec.title} details`, fields: spec.fields }],
    hasLineItems: ["bills","purchase-orders","receipts","journal-entries","transfers","assemblies"].includes(spec.slug),
    rows: sampleRows(
      spec.slug.slice(0, 3).toUpperCase(),
      [`${spec.title} record A`,`${spec.title} record B`,`${spec.title} record C`,`${spec.title} record D`,`${spec.title} record E`],
      ["$18,420","$12,250","$7,180","$22,760","$4,940"],
    ),
  };
}

for (const config of Object.values(resourceConfigs)) {
  config.rows = createResourceRows(config);
  config.presentation = getResourcePresentation(config.module, config.slug);
  config.stats = getResourceStats(config);
}
