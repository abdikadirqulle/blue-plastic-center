import "dotenv/config"
import { createDatabase } from "./client.js"
import {
  accounts,
  accountingLines,
  accountingTransactions,
  branches,
  companies,
  fiscalPeriods,
  items,
  resourceRecords,
  users,
} from "./schema.js"
import { hashPassword } from "../modules/auth/password.js"
import { PostgresResourceRepository } from "../repositories/postgres-resource-repository.js"
import type { ResourceRecord } from "../platform/types.js"

const uuidOrNull = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null

async function seed() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required to seed the database")
  const { db, close } = createDatabase(databaseUrl)

  await db
    .insert(companies)
    .values({
      id: "00000000-0000-4000-8000-000000000001",
      legalName: "BLUE PLASTIC CENTER",
      functionalCurrency: "USD",
    })
    .onConflictDoUpdate({
      target: companies.id,
      set: { legalName: "BLUE PLASTIC CENTER" },
    })

  await db
    .insert(branches)
    .values({
      id: "00000000-0000-4000-8000-000000000011",
      companyId: "00000000-0000-4000-8000-000000000001",
      name: "Main company",
      code: "MAIN",
    })
    .onConflictDoNothing()

  const seedUsers = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@blueplastic.local",
      username: "admin",
      displayName: "Abdisalam Abdulahi",
      role: "administrator",
      password: "Admin123!",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      email: "accountant@blueplastic.local",
      username: "accountant",
      displayName: "Amina Yusuf",
      role: "accountant",
      password: "Accountant123!",
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      email: "viewer@blueplastic.local",
      username: "viewer",
      displayName: "Read Only User",
      role: "viewer",
      password: "Viewer123!",
    },
  ] as const

  for (const user of seedUsers) {
    await db
      .insert(users)
      .values({
        id: user.id,
        companyId: "00000000-0000-4000-8000-000000000001",
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        passwordHash: hashPassword(user.password),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          role: user.role,
          companyId: "00000000-0000-4000-8000-000000000001",
          passwordHash: hashPassword(user.password),
        },
      })
  }

  const seedAccounts = [
    ["1000", "Cash on Hand", "asset"],
    ["1010", "Petty Cash", "asset"],
    ["1020", "Bank - Operating Account", "asset"],
    ["1030", "Mobile Money", "asset"],
    ["1100", "Accounts Receivable", "asset"],
    ["1150", "Allowance for Doubtful Accounts", "asset"],
    ["1200", "Inventory Asset", "asset"],
    ["1210", "Raw Materials Inventory", "asset"],
    ["1220", "Finished Goods Inventory", "asset"],
    ["1300", "Prepaid Expenses", "asset"],
    ["1400", "Property, Plant and Equipment", "asset"],
    ["1450", "Accumulated Depreciation", "asset"],
    ["2000", "Accounts Payable", "liability"],
    ["2050", "Accrued Expenses", "liability"],
    ["2060", "Sales Tax Payable", "liability"],
    ["2100", "Payroll Payable", "liability"],
    ["2150", "Customer Deposits", "liability"],
    ["2200", "Short-term Loans", "liability"],
    ["2300", "Long-term Loans", "liability"],
    ["3000", "Owner's Equity", "equity"],
    ["3100", "Owner Drawings", "equity"],
    ["3200", "Retained Earnings", "equity"],
    ["4000", "Sales Revenue", "income"],
    ["4010", "Product Sales", "income"],
    ["4020", "Service Revenue", "income"],
    ["4090", "Sales Discounts and Returns", "income"],
    ["4200", "Other Income", "income"],
    ["5000", "Cost of Goods Sold", "cost-of-goods-sold"],
    ["5010", "Raw Material Cost", "cost-of-goods-sold"],
    ["5020", "Direct Labour", "cost-of-goods-sold"],
    ["5030", "Manufacturing Overhead", "cost-of-goods-sold"],
    ["6000", "Salaries and Wages", "expense"],
    ["6010", "Rent Expense", "expense"],
    ["6020", "Utilities Expense", "expense"],
    ["6030", "Transport and Delivery", "expense"],
    ["6040", "Repairs and Maintenance", "expense"],
    ["6050", "Office Supplies", "expense"],
    ["6060", "Marketing and Advertising", "expense"],
    ["6070", "Bank Charges", "expense"],
    ["6080", "Professional Fees", "expense"],
    ["6090", "Depreciation Expense", "expense"],
    ["6100", "Bad Debt Expense", "expense"],
    ["6110", "Insurance Expense", "expense"],
    ["6120", "Taxes and Licences", "expense"],
    ["6900", "Other Expenses", "expense"],
  ] as const

  for (const [accountNumber, name, type] of seedAccounts) {
    await db
      .insert(accounts)
      .values({
        id: `10000000-0000-4000-8000-${accountNumber.padStart(12, "0")}`,
        companyId: "00000000-0000-4000-8000-000000000001",
        accountNumber,
        name,
        type,
        currency: "USD",
      })
      .onConflictDoUpdate({
        target: [accounts.companyId, accounts.accountNumber],
        set: { name, type, currency: "USD", active: true },
      })
  }

  const legacyRecords = await db.select().from(resourceRecords)
  for (const record of legacyRecords) {
    if (
      record.module === "accounting" &&
      record.resource === "chart-of-accounts" &&
      record.data.accountNumber &&
      (record.data.accountName || record.data.name) &&
      record.data.accountType
    ) {
      await db.insert(accounts).values({
        id: record.id,
        companyId: record.companyId,
        accountNumber: String(record.data.accountNumber),
        name: String(record.data.accountName ?? record.data.name),
        type: String(record.data.accountType),
        currency: String(record.data.currency ?? "USD"),
        active: !record.isDeleted && record.status !== "inactive",
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }).onConflictDoUpdate({
        target: [accounts.companyId, accounts.accountNumber],
        set: {
          name: String(record.data.accountName ?? record.data.name),
          type: String(record.data.accountType),
          currency: String(record.data.currency ?? "USD"),
          active: !record.isDeleted && record.status !== "inactive",
          updatedAt: record.updatedAt,
        },
      })
    }
    if (
      record.module === "inventory" &&
      record.resource === "items" &&
      record.data.sku &&
      record.data.name &&
      record.data.type
    ) {
      await db.insert(items).values({
        id: record.id,
        companyId: record.companyId,
        branchId: record.branchId,
        sku: String(record.data.sku),
        name: String(record.data.name),
        type: String(record.data.type),
        salesPrice: String(record.data.salesPrice ?? "0"),
        purchaseCost: String(record.data.purchaseCost ?? "0"),
        incomeAccountId: uuidOrNull(record.data.incomeAccountId),
        expenseAccountId: uuidOrNull(record.data.expenseAccountId),
        inventoryAccountId: uuidOrNull(record.data.inventoryAccountId),
        active: !record.isDeleted && record.status !== "inactive",
        version: record.version,
        createdBy: record.createdBy,
        updatedBy: record.updatedBy,
        isDeleted: record.isDeleted,
        deletedAt: record.deletedAt,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }).onConflictDoUpdate({
        target: [items.companyId, items.sku],
        set: {
          name: String(record.data.name),
          type: String(record.data.type),
          salesPrice: String(record.data.salesPrice ?? "0"),
          purchaseCost: String(record.data.purchaseCost ?? "0"),
          active: !record.isDeleted && record.status !== "inactive",
          version: record.version,
          updatedBy: record.updatedBy,
          isDeleted: record.isDeleted,
          deletedAt: record.deletedAt,
          updatedAt: record.updatedAt,
        },
      })
    }
  }

  const repository = new PostgresResourceRepository(db)
  const companyId = "00000000-0000-4000-8000-000000000001"
  const branchId = "00000000-0000-4000-8000-000000000011"
  const userId = "00000000-0000-4000-8000-000000000001"
  const createdAt = "2026-07-01T08:00:00.000Z"
  const demo = async (
    id: string,
    module: string,
    resource: string,
    status: string,
    data: Record<string, unknown>,
  ) => {
    const record: ResourceRecord = {
      id,
      module,
      resource,
      companyId,
      branchId,
      status,
      version: 1,
      data,
      createdAt,
      createdBy: userId,
      updatedAt: createdAt,
      updatedBy: userId,
      isDeleted: false,
    }
    const current = await repository.findById({ companyId, module, resource }, id)
    if (current) {
      await repository.update({
        ...record,
        version: current.version + 1,
        createdAt: current.createdAt,
      })
    } else {
      await repository.create(record)
    }
  }

  const customerData = [
    ["30000000-0000-4000-8000-000000000001", "Banaadir Trading Co.", "accounts@banaadir.so", "+252 61 555 1001"],
    ["30000000-0000-4000-8000-000000000002", "Sahal Distributors", "finance@sahal.so", "+252 61 555 1002"],
    ["30000000-0000-4000-8000-000000000003", "Horn Logistics", "billing@hornlogistics.so", "+252 61 555 1003"],
    ["30000000-0000-4000-8000-000000000004", "Dayax Retail", "accounts@dayax.so", "+252 61 555 1004"],
  ] as const
  for (const [id, displayName, email, phone] of customerData)
    await demo(id, "sales", "customers", "active", {
      displayName, companyName: displayName, email, phone, currency: "USD",
      paymentTerms: "Net 30", openingBalance: "0",
    })

  const accountRows = await db
    .select({ id: accounts.id, accountNumber: accounts.accountNumber })
    .from(accounts)
  const accountIds = new Map(
    accountRows.map((account) => [account.accountNumber, account.id]),
  )
  const accountId = (number: string) => {
    const id = accountIds.get(number)
    if (!id) throw new Error(`Seed account ${number} was not found`)
    return id
  }

  const ledgerEntries = [
    ["2026-01-02", "Opening owner investment", [["1020", "150000.00", "0"], ["3000", "0", "150000.00"]]],
    ["2026-01-18", "January product sales", [["1100", "23800.00", "0"], ["4010", "0", "23800.00"]]],
    ["2026-01-18", "January cost of sales", [["5000", "11200.00", "0"], ["1200", "0", "11200.00"]]],
    ["2026-01-28", "January salaries and rent", [["6000", "4600.00", "0"], ["6010", "2800.00", "0"], ["1020", "0", "7400.00"]]],
    ["2026-02-14", "February product sales", [["1100", "28650.00", "0"], ["4010", "0", "28650.00"]]],
    ["2026-02-14", "February cost of sales", [["5000", "13400.00", "0"], ["1200", "0", "13400.00"]]],
    ["2026-02-25", "February operating expenses", [["6000", "4800.00", "0"], ["6020", "940.00", "0"], ["1020", "0", "5740.00"]]],
    ["2026-03-12", "March cash sales", [["1020", "32200.00", "0"], ["4010", "0", "32200.00"]]],
    ["2026-03-12", "March cost of sales", [["5000", "15100.00", "0"], ["1200", "0", "15100.00"]]],
    ["2026-03-27", "March operating expenses", [["6000", "5000.00", "0"], ["6010", "2800.00", "0"], ["6030", "1100.00", "0"], ["1020", "0", "8900.00"]]],
    ["2026-04-16", "April product sales", [["1100", "35750.00", "0"], ["4010", "0", "35750.00"]]],
    ["2026-04-16", "April cost of sales", [["5000", "16800.00", "0"], ["1200", "0", "16800.00"]]],
    ["2026-04-29", "April operating expenses", [["6000", "5200.00", "0"], ["6020", "1020.00", "0"], ["1020", "0", "6220.00"]]],
    ["2026-05-15", "May product sales", [["1100", "39100.00", "0"], ["4010", "0", "39100.00"]]],
    ["2026-05-15", "May cost of sales", [["5000", "18450.00", "0"], ["1200", "0", "18450.00"]]],
    ["2026-05-30", "May operating expenses", [["6000", "5400.00", "0"], ["6010", "2800.00", "0"], ["6030", "1250.00", "0"], ["1020", "0", "9450.00"]]],
    ["2026-06-13", "June cash sales", [["1020", "42800.00", "0"], ["4010", "0", "42800.00"]]],
    ["2026-06-13", "June cost of sales", [["5000", "20100.00", "0"], ["1200", "0", "20100.00"]]],
    ["2026-06-28", "June operating expenses", [["6000", "5600.00", "0"], ["6020", "1180.00", "0"], ["1020", "0", "6780.00"]]],
    ["2026-07-10", "July product sales", [["1100", "48250.00", "0"], ["4010", "0", "48250.00"]]],
    ["2026-07-10", "July cost of sales", [["5000", "22600.00", "0"], ["1200", "0", "22600.00"]]],
    ["2026-07-25", "July operating expenses", [["6000", "5800.00", "0"], ["6010", "2800.00", "0"], ["6020", "1240.00", "0"], ["1020", "0", "9840.00"]]],
  ] as const
  for (const [entryIndex, [date, memo, lines]] of ledgerEntries.entries()) {
    const transactionId = `60000000-0000-4000-8000-${String(entryIndex + 1).padStart(12, "0")}`
    await db.insert(accountingTransactions).values({
      id: transactionId,
      companyId: "00000000-0000-4000-8000-000000000001",
      branchId: "00000000-0000-4000-8000-000000000011",
      transactionNumber: `SEED-JE-${String(entryIndex + 1).padStart(4, "0")}`,
      transactionDate: new Date(`${date}T12:00:00.000Z`),
      sourceModule: "seed",
      status: "posted",
      currency: "USD",
      memo,
      postedAt: new Date(`${date}T12:00:00.000Z`),
      postedBy: "00000000-0000-4000-8000-000000000001",
    }).onConflictDoUpdate({
      target: accountingTransactions.id,
      set: { transactionDate: new Date(`${date}T12:00:00.000Z`), memo, status: "posted" },
    })
    for (const [lineIndex, [accountNumber, debit, credit]] of lines.entries()) {
      const lineId = `61000000-0000-4000-8000-${String((entryIndex + 1) * 10 + lineIndex + 1).padStart(12, "0")}`
      await db.insert(accountingLines).values({
        id: lineId,
        transactionId,
        accountId: accountId(accountNumber),
        description: memo,
        debit,
        credit,
        lineNumber: lineIndex + 1,
      }).onConflictDoUpdate({
        target: accountingLines.id,
        set: { accountId: accountId(accountNumber), description: memo, debit, credit },
      })
    }
  }
  const itemData = [
    ["40000000-0000-4000-8000-000000000001", "BPC-HDPE-25", "HDPE Blue Container 25L", "18.50", "12.25", "240"],
    ["40000000-0000-4000-8000-000000000002", "BPC-HDPE-50", "HDPE Blue Drum 50L", "32.00", "22.40", "165"],
    ["40000000-0000-4000-8000-000000000003", "BPC-PET-01", "PET Bottle 1L", "1.20", "0.68", "2400"],
    ["40000000-0000-4000-8000-000000000004", "BPC-CAP-01", "Tamper-proof Cap", "0.18", "0.08", "7800"],
    ["40000000-0000-4000-8000-000000000005", "BPC-DELIVERY", "Customer Delivery Service", "35.00", "18.00", "0"],
  ] as const
  for (const [id, sku, name, salesPrice, purchaseCost, openingQuantity] of itemData)
    await demo(id, "inventory", "items", "active", {
      sku, name, type: sku === "BPC-DELIVERY" ? "service" : "inventory",
      unit: "Each", salesDescription: name, salesPrice, purchaseCost,
      openingQuantity, incomeAccountId: accountId("4010"),
      expenseAccountId: accountId("5000"),
      inventoryAccountId: accountId("1200"),
    })

  const invoiceData = [
    ["50000000-0000-4000-8000-000000000001", "INV-01001", customerData[0][0], "2026-07-03", "2026-08-02", "paid", itemData[0][0], "120", "18.50", "2220.00", "0.00"],
    ["50000000-0000-4000-8000-000000000002", "INV-01002", customerData[1][0], "2026-07-10", "2026-08-09", "open", itemData[1][0], "80", "32.00", "2560.00", "2560.00"],
    ["50000000-0000-4000-8000-000000000003", "INV-01003", customerData[2][0], "2026-06-15", "2026-07-15", "overdue", itemData[2][0], "1500", "1.20", "1800.00", "1800.00"],
    ["50000000-0000-4000-8000-000000000004", "INV-01004", customerData[3][0], "2026-07-24", "2026-08-23", "draft", itemData[3][0], "5000", "0.18", "900.00", "900.00"],
  ] as const
  for (const [id, documentNumber, customerId, invoiceDate, dueDate, status, itemId, quantity, unitPrice, total, balanceDue] of invoiceData)
    await demo(id, "sales", "invoices", status, {
      documentNumber, customerId, invoiceDate, dueDate, currency: "USD",
      exchangeRate: "1", terms: "Net 30", template: "Product invoice",
      subtotal: total, taxTotal: "0", total,
      amountPaid: status === "paid" ? total : "0", balanceDue,
      memo: "BLUE PLASTIC CENTER demonstration transaction",
      lines: [{ itemId, description: "Plastic products", quantity, unitPrice }],
    })

  const genericDemo: Array<[string, string, string, string, Record<string, unknown>]> = [
    ["51000000-0000-4000-8000-000000000001", "sales", "sales-receipts", "paid", { documentNumber: "SR-01001", customerId: customerData[3][0], saleDate: "2026-07-26", paymentMethod: "Cash", depositToAccountId: accountId("1000"), currency: "USD", total: "640.00", lines: [{ itemId: itemData[2][0], description: "PET Bottle 1L", quantity: "500", unitPrice: "1.20" }] }],
    ["51000000-0000-4000-8000-000000000002", "sales", "sales-receipts", "paid", { documentNumber: "SR-01002", customerId: customerData[0][0], saleDate: "2026-07-27", paymentMethod: "Mobile money", depositToAccountId: accountId("1030"), currency: "USD", total: "925.00", lines: [{ itemId: itemData[0][0], description: "HDPE Blue Container 25L", quantity: "50", unitPrice: "18.50" }] }],
    ["52000000-0000-4000-8000-000000000001", "sales", "payments", "applied", { documentNumber: "PAY-01001", customerId: customerData[0][0], paymentDate: "2026-07-20", amount: "2220.00", currency: "USD", depositToAccountId: accountId("1020"), paymentMethod: "Bank transfer", reference: "TRX-784521", allocations: [{ invoiceId: invoiceData[0][0], amount: "2220.00" }] }],
    ["52000000-0000-4000-8000-000000000002", "sales", "payments", "unapplied", { documentNumber: "PAY-01002", customerId: customerData[1][0], paymentDate: "2026-07-27", amount: "1000.00", currency: "USD", depositToAccountId: accountId("1020"), paymentMethod: "Cheque", reference: "CHQ-1048", allocations: [] }],
    ["53000000-0000-4000-8000-000000000001", "purchasing", "vendors", "active", { displayName: "SomPolymer Supplies", companyName: "SomPolymer Supplies", email: "accounts@sompolymer.so", phone: "+252 61 555 2001", currency: "USD", openingBalance: "0" }],
    ["53000000-0000-4000-8000-000000000002", "purchasing", "vendors", "active", { displayName: "Gulf Resin Trading", companyName: "Gulf Resin Trading", email: "finance@gulfresin.com", phone: "+971 50 555 2002", currency: "USD", openingBalance: "0" }],
    ["54000000-0000-4000-8000-000000000001", "purchasing", "bills", "open", { documentNumber: "BILL-02001", vendorId: "53000000-0000-4000-8000-000000000001", billDate: "2026-07-12", dueDate: "2026-08-11", currency: "USD", total: "12400.00", balanceDue: "12400.00", memo: "Raw materials purchase", lines: [{ accountId: accountId("5010"), description: "HDPE resin", quantity: "1", unitPrice: "12400.00" }] }],
    ["54000000-0000-4000-8000-000000000002", "purchasing", "bills", "paid", { documentNumber: "BILL-02002", vendorId: "53000000-0000-4000-8000-000000000002", billDate: "2026-06-28", dueDate: "2026-07-28", currency: "USD", total: "6850.00", balanceDue: "0", memo: "PET raw material" }],
    ["55000000-0000-4000-8000-000000000001", "banking", "accounts", "active", { accountName: "Premier Operating Account", accountType: "Bank", bankName: "Premier Bank", accountNumber: "2048", currency: "USD", openingBalance: "284420.00", asOf: "2026-07-28", glAccount: accountId("1020") }],
    ["55000000-0000-4000-8000-000000000002", "banking", "accounts", "active", { accountName: "EVC Plus Collections", accountType: "Mobile money", bankName: "Hormuud", accountNumber: "7712", currency: "USD", openingBalance: "42680.00", asOf: "2026-07-28", glAccount: accountId("1030") }],
    ["55000000-0000-4000-8000-000000000003", "banking", "accounts", "active", { accountName: "Petty Cash", accountType: "Cash", accountNumber: "PC-01", currency: "USD", openingBalance: "3850.00", asOf: "2026-07-28", glAccount: accountId("1010") }],
    ["56000000-0000-4000-8000-000000000001", "banking", "transactions", "cleared", { documentNumber: "BT-03001", account: "Premier Operating Account", type: "Deposit", date: "2026-07-20", payee: "Banaadir Trading Co.", reference: "TRX-784521", category: "Accounts Receivable", amount: "2220.00" }],
    ["56000000-0000-4000-8000-000000000002", "banking", "transactions", "cleared", { documentNumber: "BT-03002", account: "Premier Operating Account", type: "Withdrawal", date: "2026-07-22", payee: "SomPolymer Supplies", reference: "WIRE-8821", category: "Accounts Payable", amount: "-6200.00" }],
    ["57000000-0000-4000-8000-000000000001", "debts", "receivables", "open", { documentNumber: "AR-04001", customerId: customerData[1][0], invoiceId: invoiceData[1][0], dueDate: "2026-08-09", originalAmount: "2560.00", outstanding: "2560.00", agingBucket: "Current" }],
    ["57000000-0000-4000-8000-000000000002", "debts", "receivables", "overdue", { documentNumber: "AR-04002", customerId: customerData[2][0], invoiceId: invoiceData[2][0], dueDate: "2026-07-15", originalAmount: "1800.00", outstanding: "1800.00", agingBucket: "1-30 days" }],
    ["58000000-0000-4000-8000-000000000001", "debts", "payables", "open", { documentNumber: "AP-05001", vendorId: "53000000-0000-4000-8000-000000000001", billId: "54000000-0000-4000-8000-000000000001", dueDate: "2026-08-11", originalAmount: "12400.00", outstanding: "12400.00", agingBucket: "Current" }],
  ]
  for (const [id, module, resource, status, data] of genericDemo)
    await demo(id, module, resource, status, data)

  const notificationData: Array<[string, string, Record<string, unknown>]> = [
    ["59000000-0000-4000-8000-000000000001", "unread", { title: "Invoice INV-01003 is overdue", message: "Horn Logistics has an outstanding balance of $1,800.00 requiring collection follow-up.", category: "Customers & Receivables", severity: "critical", href: `/sales/invoices/${invoiceData[2][0]}`, actionRequired: true, occurredAt: "2026-07-28T08:15:00.000Z", recipientUserId: userId, readAt: null }],
    ["59000000-0000-4000-8000-000000000002", "unread", { title: "Inventory requires attention", message: "Review stock availability and reorder requirements before confirming new sales orders.", category: "Inventory", severity: "warning", href: "/inventory/stock-levels", actionRequired: true, occurredAt: "2026-07-28T07:40:00.000Z", recipientUserId: userId, readAt: null }],
    ["59000000-0000-4000-8000-000000000003", "unread", { title: "Vendor bill BILL-02001 is awaiting payment", message: "SomPolymer Supplies has $12,400.00 due on 11 Aug 2026.", category: "Vendors & Payables", severity: "warning", href: "/purchasing/bills/54000000-0000-4000-8000-000000000001", actionRequired: true, occurredAt: "2026-07-28T06:20:00.000Z", recipientUserId: userId, readAt: null }],
    ["59000000-0000-4000-8000-000000000004", "read", { title: "Payment PAY-01001 was applied", message: "$2,220.00 from Banaadir Trading Co. was applied to INV-01001.", category: "Customers & Receivables", severity: "success", href: "/sales/payments/52000000-0000-4000-8000-000000000001", actionRequired: false, occurredAt: "2026-07-27T16:10:00.000Z", recipientUserId: userId, readAt: "2026-07-27T16:30:00.000Z" }],
  ]
  for (const [id, status, data] of notificationData)
    await demo(id, "setup", "notifications", status, data)

  await db
    .insert(fiscalPeriods)
    .values({
      id: "20000000-0000-4000-8000-000000000001",
      companyId: "00000000-0000-4000-8000-000000000001",
      name: "FY 2026",
      startDate: new Date("2026-01-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T23:59:59.999Z"),
      status: "open",
    })
    .onConflictDoUpdate({
      target: [fiscalPeriods.companyId, fiscalPeriods.name],
      set: { status: "open" },
    })

  await close()
  console.log("BLUE PLASTIC CENTER database seed completed")
}

await seed()
