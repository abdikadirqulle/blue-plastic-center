export interface ResourceDefinition {
  name: string;
  label: string;
  requiredFields: string[];
  searchableFields: string[];
}

export interface ModuleDefinition {
  name: string;
  label: string;
  resources: Record<string, ResourceDefinition>;
}

const resource = (
  name: string,
  label: string,
  requiredFields: string[] = ["name"],
  searchableFields: string[] = requiredFields,
): ResourceDefinition => ({ name, label, requiredFields, searchableFields });

export const modules: Record<string, ModuleDefinition> = {
  documents: {
    name: "documents",
    label: "Documents and delivery",
    resources: {
      attachments: resource("attachments", "Attachments", [
        "entityModule",
        "entityResource",
        "entityId",
        "fileName",
        "contentType",
        "sizeBytes",
        "storageKey",
      ]),
      "email-jobs": resource("email-jobs", "Email jobs", [
        "entityModule",
        "entityResource",
        "entityId",
        "to",
        "subject",
      ]),
      "pdf-jobs": resource("pdf-jobs", "PDF jobs", [
        "entityModule",
        "entityResource",
        "entityId",
        "template",
      ]),
    },
  },
  setup: {
    name: "setup",
    label: "Company setup",
    resources: {
      "company-settings": resource("company-settings", "Company settings", [
        "legalName",
        "functionalCurrency",
        "fiscalYearStartMonth",
        "accountingBasis",
        "timezone",
      ]),
      branches: resource("branches", "Branches", ["name", "code"]),
      currencies: resource("currencies", "Currencies", [
        "code",
        "name",
        "symbol",
        "exchangeRate",
      ]),
      "payment-terms": resource("payment-terms", "Payment terms", [
        "name",
        "dueDays",
      ]),
      "document-sequences": resource(
        "document-sequences",
        "Document sequences",
        ["documentType", "prefix", "nextNumber", "padding"],
      ),
      "opening-balances": resource("opening-balances", "Opening balances", [
        "accountId",
        "asOfDate",
        "debit",
        "credit",
      ]),
      "memorized-reports": resource("memorized-reports", "Memorized reports", [
        "name",
        "kind",
        "from",
        "to",
        "basis",
      ]),
      notifications: resource("notifications", "Notifications", [
        "title",
        "message",
        "category",
        "severity",
        "href",
        "actionRequired",
        "occurredAt",
        "recipientUserId",
        "readAt",
      ]),
    },
  },
  sales: {
    name: "sales",
    label: "Sales & receivables",
    resources: {
      invoices: resource("invoices", "Invoices", [
        "customerId",
        "invoiceDate",
        "dueDate",
        "currency",
        "lines",
      ]),
      customers: resource(
        "customers",
        "Customers",
        ["displayName"],
        ["displayName", "companyName", "email", "phone"],
      ),
      estimates: resource("estimates", "Estimates", [
        "customerId",
        "estimateDate",
        "currency",
        "lines",
      ]),
      "sales-orders": resource("sales-orders", "Sales orders", [
        "customerId",
        "orderDate",
        "currency",
        "lines",
      ]),
      payments: resource("payments", "Customer payments", [
        "customerId",
        "paymentDate",
        "amount",
        "currency",
      ]),
      "credit-notes": resource("credit-notes", "Credit notes", [
        "customerId",
        "creditDate",
        "currency",
        "lines",
      ]),
      "sales-receipts": resource("sales-receipts", "Sales receipts", [
        "customerId",
        "saleDate",
        "currency",
        "lines",
      ]),
      "refund-receipts": resource("refund-receipts", "Refund receipts", [
        "customerId",
        "refundDate",
        "currency",
        "lines",
      ]),
      statements: resource("statements", "Customer statements", [
        "customerId",
        "statementDate",
        "toDate",
      ]),
      deposits: resource("deposits", "Customer deposits", [
        "depositTo",
        "depositDate",
        "amount",
      ]),
      "recurring-invoices": resource(
        "recurring-invoices",
        "Recurring invoices",
        ["templateName", "customerId", "frequency", "startDate"],
      ),
    },
  },
  debts: {
    name: "debts",
    label: "Debts",
    resources: {
      receivables: resource("receivables", "Receivables", [
        "customerId",
        "originalAmount",
        "outstanding",
        "dueDate",
      ]),
      payables: resource("payables", "Payables", [
        "vendorId",
        "originalAmount",
        "outstanding",
        "dueDate",
      ]),
      payments: resource("payments", "Debt payments", [
        "partyType",
        "partyId",
        "paymentDate",
        "amount",
        "currency",
      ]),
    },
  },
  purchasing: {
    name: "purchasing",
    label: "Purchasing & expenses",
    resources: {
      bills: resource("bills", "Vendor bills", [
        "vendorId",
        "billDate",
        "dueDate",
        "currency",
        "lines",
      ]),
      "bill-payments": resource("bill-payments", "Bill payments", [
        "bankAccount",
        "paymentDate",
        "paymentMethod",
        "vendor",
        "bills",
      ]),
      vendors: resource(
        "vendors",
        "Vendors",
        ["displayName"],
        ["displayName", "companyName", "email", "phone"],
      ),
      "purchase-orders": resource("purchase-orders", "Purchase orders", [
        "vendorId",
        "orderDate",
        "currency",
        "lines",
      ]),
      receipts: resource("receipts", "Item receipts", [
        "vendorId",
        "receiptDate",
        "warehouseId",
        "lines",
      ]),
      "vendor-credits": resource("vendor-credits", "Vendor credits", [
        "vendor",
        "creditDate",
        "currency",
        "lines",
      ]),
      expenses: resource("expenses", "Expenses", [
        "payee",
        "paymentDate",
        "accountId",
        "amount",
      ]),
      approvals: resource("approvals", "Purchase approvals", [
        "documentType",
        "approverId",
      ]),
      checks: resource("checks", "Vendor checks", [
        "bankAccount",
        "payee",
        "checkNumber",
        "checkDate",
        "amount",
      ]),
    },
  },
  banking: {
    name: "banking",
    label: "Banking & treasury",
    resources: {
      accounts: resource("accounts", "Bank & cash accounts", [
        "accountName",
        "accountType",
        "currency",
      ]),
      "bank-feeds": resource("bank-feeds", "Bank feeds", [
        "account",
        "transactionDate",
        "amount",
        "description",
      ]),
      transactions: resource("transactions", "Bank transactions", [
        "accountId",
        "transactionDate",
        "amount",
      ]),
      "bank-rules": resource("bank-rules", "Bank rules", [
        "ruleName",
        "account",
        "condition",
        "conditionValue",
        "category",
      ]),
      deposits: resource("deposits", "Bank deposits", [
        "depositTo",
        "depositDate",
        "payments",
        "totalDeposit",
      ]),
      reconciliation: resource("reconciliation", "Reconciliations", [
        "accountId",
        "statementDate",
        "endingBalance",
      ]),
      transfers: resource("transfers", "Account transfers", [
        "fromAccountId",
        "toAccountId",
        "transferDate",
        "amount",
      ]),
      checks: resource("checks", "Bank checks", [
        "bankAccount",
        "payee",
        "checkNumber",
        "checkDate",
        "amount",
      ]),
      "cash-flow": resource("cash-flow", "Cash flow forecasts", [
        "name",
        "startDate",
        "endDate",
      ]),
    },
  },
  inventory: {
    name: "inventory",
    label: "Items & inventory",
    resources: {
      items: resource(
        "items",
        "Items & services",
        ["name", "type"],
        ["name", "sku", "barcode"],
      ),
      "stock-levels": resource("stock-levels", "Stock levels", [
        "itemId",
        "warehouseId",
        "quantity",
      ]),
      warehouses: resource("warehouses", "Warehouses", ["name", "code"]),
      transfers: resource("transfers", "Inventory transfers", [
        "fromWarehouseId",
        "toWarehouseId",
        "transferDate",
        "lines",
      ]),
      adjustments: resource("adjustments", "Inventory adjustments", [
        "adjustmentType",
        "adjustmentDate",
        "adjustmentAccount",
        "warehouse",
        "lines",
      ]),
      "stock-counts": resource("stock-counts", "Stock counts", [
        "warehouseId",
        "countDate",
      ]),
      assemblies: resource("assemblies", "Inventory assemblies", [
        "itemId",
        "buildDate",
        "quantity",
      ]),
      "lots-serials": resource("lots-serials", "Lot and serial tracking", [
        "item",
        "trackingType",
        "lotSerial",
        "warehouse",
        "quantity",
      ]),
      "reorder-planning": resource("reorder-planning", "Reorder planning", [
        "warehouse",
        "asOfDate",
        "horizon",
        "suggestions",
      ]),
      fulfillment: resource("fulfillment", "Pick, pack and ship", [
        "salesOrder",
        "warehouse",
        "lines",
      ]),
      "landed-costs": resource("landed-costs", "Landed costs", [
        "shipment",
        "costVendor",
        "allocationDate",
        "costType",
        "amount",
        "allocationMethod",
      ]),
    },
  },
  accounting: {
    name: "accounting",
    label: "Accounting",
    resources: {
      "chart-of-accounts": resource("chart-of-accounts", "Chart of accounts", [
        "accountNumber",
        "accountName",
        "accountType",
      ]),
      "journal-entries": resource("journal-entries", "Journal entries", [
        "journalDate",
        "lines",
      ]),
      registers: resource("registers", "Account registers", [
        "accountId",
        "transactionDate",
        "amount",
      ]),
      recurring: resource("recurring", "Recurring transactions", [
        "name",
        "transactionType",
        "frequency",
      ]),
      "fiscal-periods": resource("fiscal-periods", "Fiscal periods", [
        "name",
        "startDate",
        "endDate",
      ]),
      "close-center": resource("close-center", "Month-end close center", [
        "period",
        "closeDate",
        "owner",
        "checklist",
      ]),
      budgets: resource("budgets", "Budgets and forecasts", [
        "budgetName",
        "fiscalYear",
        "budgetType",
        "scenario",
        "monthlyValues",
      ]),
      "fixed-assets": resource("fixed-assets", "Fixed assets", [
        "assetName",
        "assetNumber",
        "category",
        "purchaseDate",
        "inServiceDate",
        "cost",
        "usefulLife",
        "method",
      ]),
      classes: resource("classes", "Classes and departments", ["className"]),
      "audit-log": resource("audit-log", "Audit log", [
        "action",
        "entityType",
        "entityId",
      ]),
    },
  },
  projects: {
    name: "projects",
    label: "Projects & job costing",
    resources: {
      projects: resource("projects", "Projects", ["projectName", "customerId"]),
      tasks: resource("tasks", "Project tasks", ["taskName", "projectId"]),
      time: resource("time", "Project time", [
        "employeeId",
        "projectId",
        "date",
        "hours",
      ]),
      expenses: resource("expenses", "Project expenses", [
        "projectId",
        "date",
        "amount",
      ]),
      "progress-billing": resource("progress-billing", "Progress billing", [
        "projectId",
        "invoiceDate",
        "amount",
      ]),
      "change-orders": resource("change-orders", "Project change orders", [
        "project",
        "changeNumber",
        "changeDate",
        "reason",
        "amount",
        "scope",
      ]),
      profitability: resource("profitability", "Project profitability", [
        "projectId",
        "dateFrom",
        "dateTo",
      ]),
    },
  },
  payroll: {
    name: "payroll",
    label: "Payroll & people",
    resources: {
      "pay-runs": resource("pay-runs", "Pay runs", [
        "periodStart",
        "periodEnd",
        "paymentDate",
      ]),
      employees: resource("employees", "Employees", [
        "employeeId",
        "firstName",
        "lastName",
      ]),
      timesheets: resource("timesheets", "Timesheets", [
        "employeeId",
        "weekStart",
        "hours",
      ]),
      leave: resource("leave", "Leave requests", [
        "employeeId",
        "leaveType",
        "startDate",
        "endDate",
      ]),
      loans: resource("loans", "Employee loans", ["employeeId", "principal"]),
      liabilities: resource("liabilities", "Payroll liabilities", [
        "liabilityType",
        "agency",
        "dueDate",
        "periodFrom",
        "periodTo",
        "amount",
        "payrollRuns",
      ]),
      benefits: resource("benefits", "Employee benefits", [
        "benefitName",
        "benefitType",
        "effectiveDate",
        "eligibility",
        "calculation",
        "accounts",
      ]),
      reports: resource("reports", "Payroll reports", [
        "reportType",
        "dateFrom",
        "dateTo",
      ]),
    },
  },
};

export function getResourceDefinition(
  moduleName: string,
  resourceName: string,
) {
  return modules[moduleName]?.resources[resourceName];
}
