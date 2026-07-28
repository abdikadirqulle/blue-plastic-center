import "dotenv/config"
import { createDatabase } from "./client.js"
import {
  accounts,
  branches,
  companies,
  fiscalPeriods,
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

void seed()
