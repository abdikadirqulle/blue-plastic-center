import type { EnterpriseModule, EnterpriseQuery, EnterpriseRecord, EnterpriseRepository } from "../domain/enterprise-record";

const names: Record<EnterpriseModule, string[]> = {
  accounting: ["Cash and cash equivalents", "Accounts receivable", "Inventory asset", "Accounts payable", "Sales revenue"],
  projects: ["Factory Expansion", "Hodan Warehouse Fit-out", "Dayax Packaging Contract", "New Production Line", "Fleet Upgrade"],
  payroll: ["July Monthly Payroll", "June Monthly Payroll", "Production Weekly Payroll", "Sales Commission Run", "Off-cycle Corrections"],
};

const resourceNames: Record<string, string[]> = {
  "journal-entries": ["Inventory landed-cost allocation", "July depreciation", "Payroll accrual", "FX revaluation", "Month-end adjustments"],
  registers: ["Premier Operating register", "Accounts receivable register", "Inventory asset register", "Accounts payable register", "Sales revenue register"],
  recurring: ["Monthly rent", "Asset depreciation", "Insurance amortization", "Payroll accrual", "Software subscriptions"],
  "fiscal-periods": ["July 2026", "June 2026", "Q2 2026", "May 2026", "FY 2025"],
  "audit-log": ["Journal JE-2088 posted", "Period Jun 2026 closed", "Account 1200 edited", "Bill BILL-2084 approved", "User role updated"],
  budgets: ["FY 2026 Operating Budget", "Sales Budget 2026", "Production Budget 2026", "Cash Budget Q3", "Factory Expansion Budget"],
  "fixed-assets": ["Injection Molding Machine #04", "Delivery Truck BPC-08", "Factory Building", "Generator 500 KVA", "Office Equipment Pool"],
  classes: ["Production", "Wholesale Sales", "Retail Sales", "Logistics", "Administration"],
  "close-center": ["Bank reconciliations", "Accounts receivable review", "Accounts payable review", "Inventory valuation", "Financial statements"],
  projects: ["Factory Expansion", "Hodan Warehouse Fit-out", "Dayax Packaging Contract", "New Production Line", "Fleet Upgrade"],
  tasks: ["Foundation and civil works", "Electrical installation", "Equipment procurement", "Commissioning", "Handover"],
  time: ["Ahmed Hassan · Factory Expansion", "Fadumo Ali · Warehouse Fit-out", "Abdi Noor · Production Line", "Maryan Omar · Packaging Contract", "Khalid Yusuf · Fleet Upgrade"],
  expenses: ["Concrete and steel", "Electrical materials", "Consulting fees", "Equipment freight", "Vehicle registration"],
  "progress-billing": ["Factory Expansion · Milestone 3", "Warehouse Fit-out · Milestone 2", "Packaging Contract · July", "Production Line · Deposit", "Fleet Upgrade · Final"],
  profitability: ["Factory Expansion", "Hodan Warehouse Fit-out", "Dayax Packaging Contract", "New Production Line", "Fleet Upgrade"],
  "change-orders": ["Factory Expansion CO-07", "Warehouse Fit-out CO-03", "Packaging Contract CO-02", "Production Line CO-05", "Fleet Upgrade CO-01"],
  "pay-runs": ["July Monthly Payroll", "June Monthly Payroll", "Production Weekly Payroll", "Sales Commission Run", "Off-cycle Corrections"],
  employees: ["Ahmed Hassan", "Fadumo Ali", "Abdi Noor", "Maryan Omar", "Khalid Yusuf"],
  timesheets: ["Ahmed Hassan · Week 30", "Fadumo Ali · Week 30", "Abdi Noor · Week 30", "Maryan Omar · Week 30", "Khalid Yusuf · Week 30"],
  leave: ["Ahmed Hassan · Annual leave", "Fadumo Ali · Sick leave", "Abdi Noor · Annual leave", "Maryan Omar · Parental leave", "Khalid Yusuf · Unpaid leave"],
  loans: ["Ahmed Hassan · Staff loan", "Fadumo Ali · Salary advance", "Abdi Noor · Staff loan", "Maryan Omar · Salary advance", "Khalid Yusuf · Staff loan"],
  liabilities: ["Payroll tax payable", "Pension contributions", "Employee deductions", "Health insurance", "Net payroll clearing"],
  benefits: ["Health insurance", "Pension plan", "Transport allowance", "Housing allowance", "Meal allowance"],
  reports: ["Payroll summary", "Employee earnings", "Payroll liabilities", "Leave balances", "Department payroll"],
};

const statusesByResource: Record<string, string[]> = {
  "journal-entries": ["Posted", "Posted", "Draft", "Pending approval", "Posted"],
  "fiscal-periods": ["Open", "Closed", "Closed", "Closed", "Locked"],
  "audit-log": ["Completed", "Completed", "Reviewed", "Approved", "Completed"],
  budgets: ["Active", "Active", "Active", "Draft", "Over budget"],
  "fixed-assets": ["In service", "In service", "In service", "Maintenance", "In service"],
  "close-center": ["Complete", "Complete", "Needs review", "In progress", "Blocked"],
  projects: ["Active", "Active", "On hold", "Planning", "Completed"],
  profitability: ["On budget", "At risk", "Profitable", "Over budget", "Completed"],
  "change-orders": ["Approved", "Pending approval", "Draft", "Approved", "Rejected"],
  "pay-runs": ["Ready to approve", "Paid", "Processing", "Draft", "Needs review"],
  employees: ["Active", "Active", "On leave", "Active", "Inactive"],
  liabilities: ["Due", "Paid", "Due", "Scheduled", "Reconciled"],
  benefits: ["Active", "Active", "Active", "Active", "Draft"],
};

export function mockEnterpriseRecords(module: EnterpriseModule, resource: string): EnterpriseRecord[] {
  const list = resourceNames[resource] ?? names[module];
  const statuses = statusesByResource[resource] ?? ["Active", "Posted", "Pending", "Draft", "Completed"];
  return list.map((name, index) => ({
    id: `${resource.replaceAll("-", "").slice(0, 3).toUpperCase()}-${3088 - index}`,
    module,
    resource,
    name,
    detail: ["Main company · USD", "Mogadishu branch", "Production division", "Finance review", "All branches"][index],
    value: ["$284,420", "$148,250", "$92,180", "$46,760", "$24,940"][index],
    date: ["2026-07-27", "2026-07-26", "2026-07-25", "2026-07-23", "2026-07-20"][index],
    status: statuses[index],
    metrics: {
      debit: ["$284,420", "$148,250", "$92,180", "$46,760", "$24,940"][index],
      credit: ["$284,420", "$148,250", "$92,180", "$46,760", "$24,940"][index],
      progress: ["82%", "68%", "54%", "36%", "100%"][index],
      variance: ["+$12,400", "-$8,250", "+$4,180", "-$16,760", "$0"][index],
    },
  }));
}

export class MockEnterpriseRepository implements EnterpriseRepository {
  private store = new Map<string, EnterpriseRecord[]>();
  private records(module: EnterpriseModule, resource: string) {
    const key = `${module}/${resource}`;
    if (!this.store.has(key)) this.store.set(key, mockEnterpriseRecords(module, resource));
    return this.store.get(key) ?? [];
  }
  async list(module: EnterpriseModule, resource: string, query: EnterpriseQuery = {}) {
    const search = query.search?.toLowerCase();
    return this.records(module, resource).filter((record) =>
      (!search || `${record.id} ${record.name} ${record.detail}`.toLowerCase().includes(search))
      && (!query.status || query.status === "All statuses" || record.status === query.status),
    ).map((record) => ({ ...record, metrics: { ...record.metrics } }));
  }
  async get(module: EnterpriseModule, resource: string, id: string) {
    return this.records(module, resource).find((record) => record.id === id) ?? null;
  }
  async update(module: EnterpriseModule, resource: string, id: string, values: Partial<EnterpriseRecord>) {
    const current = await this.get(module, resource, id);
    if (!current) throw new Error(`${id} was not found`);
    const updated = { ...current, ...values };
    this.store.set(`${module}/${resource}`, this.records(module, resource).map((record) => record.id === id ? updated : record));
    return updated;
  }
  async remove(module: EnterpriseModule, resource: string, id: string) {
    this.store.set(`${module}/${resource}`, this.records(module, resource).filter((record) => record.id !== id));
  }
}
