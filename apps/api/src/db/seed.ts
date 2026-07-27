import "dotenv/config"
import { eq } from "drizzle-orm"
import { createDatabase } from "./client.js"
import {
  accountingLines,
  accountingTransactions,
  accounts,
  branches,
  companies,
  customers,
  fiscalPeriods,
  invoices,
  resourceRecords,
  users,
} from "./schema.js"
import { hashPassword } from "../modules/auth/password.js"

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
      displayName: "Abdisalam Abdulahi",
      role: "administrator",
      password: "Admin123!",
    },
    {
      id: "00000000-0000-4000-8000-000000000002",
      email: "accountant@blueplastic.local",
      displayName: "Amina Yusuf",
      role: "accountant",
      password: "Accountant123!",
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      email: "viewer@blueplastic.local",
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
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        passwordHash: hashPassword(user.password),
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: user.email,
          displayName: user.displayName,
          role: user.role,
          companyId: "00000000-0000-4000-8000-000000000001",
          passwordHash: hashPassword(user.password),
        },
      })
  }

  const seedAccounts = [
    ["1000", "Cash and Bank", "asset"],
    ["1100", "Accounts Receivable", "asset"],
    ["1200", "Inventory", "asset"],
    ["2000", "Accounts Payable", "liability"],
    ["2100", "Payroll Payable", "liability"],
    ["3000", "Owner's Equity", "equity"],
    ["4000", "Sales Revenue", "income"],
    ["5000", "Cost of Goods Sold", "cost-of-goods-sold"],
    ["6000", "Operating Expenses", "expense"],
  ] as const

  for (const [index, [accountNumber, name, type]] of seedAccounts.entries()) {
    await db
      .insert(accounts)
      .values({
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
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

  const records = [
    ["purchasing", "vendors", "active", { displayName: "Somali Polymer Supply", email: "sales@polymer.so", phone: "+252 61 500 1000", currency: "USD" }],
    ["purchasing", "bills", "open", { documentNumber: "BILL-00001", vendor: "Somali Polymer Supply", billDate: "2026-07-18", dueDate: "2026-08-17", currency: "USD", total: 3500, balanceDue: 3500 }],
    ["inventory", "items", "active", { name: "Blue HDPE Container 20L", sku: "BPC-HDPE-20", type: "inventory", salesPrice: 18.5, purchaseCost: 10.25 }],
    ["inventory", "stock-levels", "active", { item: "Blue HDPE Container 20L", warehouse: "Main Warehouse", quantity: 840, averageCost: 10.25, reorderPoint: 250 }],
    ["banking", "accounts", "active", { name: "Premier Bank Operating", accountNumber: "PB-USD-001", type: "checking", currency: "USD", currentBalance: 49000 }],
    ["banking", "transactions", "posted", { description: "Customer payment deposit", transactionDate: "2026-07-20", type: "deposit", account: "Premier Bank Operating", amount: 12500 }],
    ["accounting", "chart-of-accounts", "active", { accountNumber: "1000", name: "Cash and Bank", type: "asset", currency: "USD", balance: 9000 }],
    ["accounting", "chart-of-accounts", "active", { accountNumber: "4000", name: "Sales Revenue", type: "income", currency: "USD", balance: 12500 }],
    ["accounting", "chart-of-accounts", "active", { accountNumber: "6000", name: "Operating Expenses", type: "expense", currency: "USD", balance: 3500 }],
    ["debts", "receivables", "open", { customer: "Mogadishu Retail Ltd", reference: "INV-00001", dueDate: "2026-08-19", originalAmount: 12500, balance: 12500, currency: "USD" }],
    ["debts", "payables", "open", { vendor: "Somali Polymer Supply", reference: "BILL-00001", dueDate: "2026-08-17", originalAmount: 3500, balance: 3500, currency: "USD" }],
    ["projects", "projects", "active", { name: "Warehouse Capacity Expansion", customer: "BLUE PLASTIC CENTER", startDate: "2026-07-01", status: "active", budget: 25000 }],
    ["payroll", "employees", "active", { employeeNumber: "EMP-001", displayName: "Ahmed Nur", email: "ahmed.nur@blueplastic.local", department: "Production", hireDate: "2025-01-15" }],
    ["setup", "company-settings", "active", { legalName: "BLUE PLASTIC CENTER", tradingName: "BLUE PLASTIC CENTER", functionalCurrency: "USD", fiscalYearStartMonth: 1, accountingBasis: "accrual", timezone: "Africa/Mogadishu" }],
    ["setup", "branches", "active", { name: "Main company", code: "MAIN", address: "Mogadishu, Somalia" }],
    ["setup", "currencies", "active", { code: "USD", name: "US Dollar", symbol: "$", exchangeRate: 1 }],
    ["setup", "tax-codes", "active", { code: "ZERO", name: "Zero rated", rate: 0 }],
  ] as const

  for (const [index, [module, resource, status, data]] of records.entries()) {
    const id = `30000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`
    await db.insert(resourceRecords).values({
      id,
      module,
      resource,
      companyId: "00000000-0000-4000-8000-000000000001",
      branchId: "00000000-0000-4000-8000-000000000011",
      status,
      data,
      createdBy: "00000000-0000-4000-8000-000000000001",
      updatedBy: "00000000-0000-4000-8000-000000000001",
    }).onConflictDoUpdate({
      target: resourceRecords.id,
      set: { status, data, isDeleted: false, deletedAt: null },
    })
  }

  const customerSeeds = [
    { id: "30000000-0000-4000-8000-000000000001", displayName: "Mogadishu Retail Ltd", email: "accounts@mogretail.so", phone: "+252 61 400 1000", openingBalance: "2400" },
    { id: "30000000-0000-4000-8000-000000000002", displayName: "Hodan Wholesale", email: "finance@hodanwholesale.so", phone: "+252 61 400 2000", openingBalance: "0" },
  ]
  for (const customer of customerSeeds) {
    await db.insert(customers).values({
      ...customer,
      companyId: "00000000-0000-4000-8000-000000000001",
      branchId: "00000000-0000-4000-8000-000000000011",
      currency: "USD",
      createdBy: "00000000-0000-4000-8000-000000000001",
      updatedBy: "00000000-0000-4000-8000-000000000001",
    }).onConflictDoUpdate({
      target: customers.id,
      set: { displayName: customer.displayName, email: customer.email, phone: customer.phone, openingBalance: customer.openingBalance, isDeleted: false, deletedAt: null },
    })
  }
  for (const duplicateId of [
    "31000000-0000-4000-8000-000000000001",
    "31000000-0000-4000-8000-000000000002",
  ]) {
    await db.update(customers).set({
      isDeleted: true,
      deletedAt: new Date(),
      updatedBy: "00000000-0000-4000-8000-000000000001",
    }).where(eq(customers.id, duplicateId))
  }

  await db.insert(invoices).values({
    id: "32000000-0000-4000-8000-000000000001",
    companyId: "00000000-0000-4000-8000-000000000001",
    branchId: "00000000-0000-4000-8000-000000000011",
    customerId: "30000000-0000-4000-8000-000000000001",
    invoiceNumber: "INV-00001",
    invoiceDate: new Date("2026-07-20T12:00:00.000Z"),
    dueDate: new Date("2026-08-19T12:00:00.000Z"),
    currency: "USD",
    status: "open",
    subtotal: "12500",
    total: "12500",
    balanceDue: "12500",
    createdBy: "00000000-0000-4000-8000-000000000001",
    updatedBy: "00000000-0000-4000-8000-000000000001",
  }).onConflictDoUpdate({
    target: [invoices.companyId, invoices.invoiceNumber],
    set: { customerId: "30000000-0000-4000-8000-000000000001", status: "open", total: "12500", balanceDue: "12500", isDeleted: false, deletedAt: null },
  })

  const journals = [
    { id: "40000000-0000-4000-8000-000000000001", number: "SEED-SALE-001", date: "2026-07-20", memo: "Posted customer sale", debitAccount: 0, creditAccount: 6, amount: "12500.0000" },
    { id: "40000000-0000-4000-8000-000000000002", number: "SEED-EXP-001", date: "2026-07-21", memo: "Posted operating expense", debitAccount: 8, creditAccount: 0, amount: "3500.0000" },
  ] as const
  for (const [journalIndex, journal] of journals.entries()) {
    await db.insert(accountingTransactions).values({
      id: journal.id,
      companyId: "00000000-0000-4000-8000-000000000001",
      branchId: "00000000-0000-4000-8000-000000000011",
      transactionNumber: journal.number,
      transactionDate: new Date(`${journal.date}T12:00:00.000Z`),
      sourceModule: "seed",
      fiscalPeriodId: "20000000-0000-4000-8000-000000000001",
      status: "posted",
      currency: "USD",
      memo: journal.memo,
      postedAt: new Date(`${journal.date}T12:00:00.000Z`),
      postedBy: "00000000-0000-4000-8000-000000000001",
    }).onConflictDoNothing()
    const lineIdBase = journalIndex * 2
    await db.insert(accountingLines).values([
      {
        id: `50000000-0000-4000-8000-${String(lineIdBase + 1).padStart(12, "0")}`,
        transactionId: journal.id,
        accountId: `10000000-0000-4000-8000-${String(journal.debitAccount + 1).padStart(12, "0")}`,
        description: journal.memo,
        debit: journal.amount,
        credit: "0",
        lineNumber: 1,
      },
      {
        id: `50000000-0000-4000-8000-${String(lineIdBase + 2).padStart(12, "0")}`,
        transactionId: journal.id,
        accountId: `10000000-0000-4000-8000-${String(journal.creditAccount + 1).padStart(12, "0")}`,
        description: journal.memo,
        debit: "0",
        credit: journal.amount,
        lineNumber: 2,
      },
    ]).onConflictDoNothing()
  }

  await close()
  console.log("BLUE PLASTIC CENTER database seed completed")
}

void seed()
