import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Al-Furat dashboard", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Al-Furat System<\/title>/i);
  assert.match(html, /Good evening, Abdikadir/);
  assert.match(html, /Cash flow overview/);
  assert.match(html, /Receivables health/);
  assert.match(html, /Recent activity/);
  assert.match(html, /Items &amp; inventory/);
  assert.match(html, /Business modules/);
  assert.match(html, /Payables health/);
  assert.match(html, /Upcoming deadlines/);
  assert.match(html, /Sales leaderboard/);
  assert.match(html, /Budget vs actual/);
  assert.match(html, /Purchasing &amp; expenses/);
  assert.match(html, /Projects &amp; job costing/);
  assert.match(html, /Company settings/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("renders module-specific records, columns, filters, and layouts", async () => {
  const bills = await render("/purchasing/bills");
  const billsHtml = await bills.text();
  assert.match(billsHtml, /Horn Logistics/);
  assert.match(billsHtml, /Due date/);
  assert.doesNotMatch(billsHtml, /record A|Main company · Main branch/i);

  const inventory = await render("/inventory/items");
  const inventoryHtml = await inventory.text();
  assert.match(inventoryHtml, /Cement 50kg/);
  assert.match(inventoryHtml, /On hand/);
  assert.match(inventoryHtml, /Sales price/);

  const payroll = await render("/payroll/timesheets");
  const payrollHtml = await payroll.text();
  assert.match(payrollHtml, /Ahmed Hassan/);
  assert.match(payrollHtml, /40.0 hrs/);

  const cashFlow = await render("/banking/cash-flow");
  const cashFlowHtml = await cashFlow.text();
  assert.match(cashFlowHtml, /Opening cash/);
  assert.match(cashFlowHtml, /Closing cash/);
  assert.doesNotMatch(cashFlowHtml, /<table/i);
});

test("server-renders every primary workspace and dedicated sales page", async () => {
  const expected = {
    "/sales/invoices": "Invoices",
    "/sales/customers": "Customers",
    "/sales/estimates": "Estimates",
    "/sales/sales-orders": "Sales orders",
    "/sales/payments": "Payments",
    "/sales/credit-notes": "Credit notes",
    "/debts/receivables": "Receivables",
    "/debts/payables": "Payables",
    "/debts/payments": "Debt payments",
    "/purchasing/bills": "Vendor bills",
    "/banking/accounts": "Bank &amp; cash accounts",
    "/inventory/items": "Items &amp; services",
    "/accounting/chart-of-accounts": "Chart of accounts",
    "/projects/projects": "Projects",
    "/payroll/pay-runs": "Pay runs",
    "/reports/financial": "Reports",
    "/settings/company": "Company settings",
    "/notifications": "Notifications",
    "/profile": "My profile",
    "/import": "Import data",
    "/login": "Sign in to your workspace",
  };

  for (const [pathname, title] of Object.entries(expected)) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), new RegExp(title), pathname);
  }
});

test("renders the debts workspace with its three dedicated tabs", async () => {
  const receivables = await render("/debts/receivables");
  const html = await receivables.text();
  assert.match(html, /Receivables/);
  assert.match(html, /Payables/);
  assert.match(html, /Payments/);
  assert.match(html, /Customer debt/);
  assert.match(html, /Original amount/);
  assert.match(html, /Outstanding/);
  assert.match(html, /Banaadir Trading Co/);

  const payables = await render("/debts/payables");
  assert.match(await payables.text(), /Horn Logistics/);

  const payments = await render("/debts/payments");
  const paymentsHtml = await payments.text();
  assert.match(paymentsHtml, /Customer receipt/);
  assert.match(paymentsHtml, /Vendor payment/);
});

test("reports and settings use purpose-built non-table layouts", async () => {
  const reports = await render("/reports/financial");
  const reportsHtml = await reports.text();
  assert.match(reportsHtml, /Profit and Loss/);
  assert.match(reportsHtml, /01 Jul 2026/);
  assert.doesNotMatch(reportsHtml, /<table/i);

  const settings = await render("/settings/company");
  const settingsHtml = await settings.text();
  assert.match(settingsHtml, /Company identity/);
  assert.match(settingsHtml, /Save settings/);
  assert.doesNotMatch(settingsHtml, /<table/i);
});

test("server-renders full-page forms with both save workflows", async () => {
  for (const pathname of [
    "/sales/invoices/new",
    "/purchasing/bills/new",
    "/inventory/items/new",
    "/accounting/journal-entries/new",
  ]) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, /Save &amp; new/, pathname);
    assert.match(html, /Save &amp; close/, pathname);
  }
});

test("server-renders complete record detail pages", async () => {
  const routes = [
    "/sales/invoices/INV-1048",
    "/purchasing/bills/BIL-1048",
    "/banking/accounts/ACC-1048",
    "/inventory/items/ITE-1048",
    "/accounting/chart-of-accounts/CHA-1048",
    "/projects/projects/PRO-1048",
    "/payroll/pay-runs/PAY-1048",
  ];

  for (const pathname of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, /Edit this record/, pathname);
    assert.match(html, /Delete record/, pathname);
    assert.match(html, /Activity/, pathname);
  }

  const invoice = await render(routes[0]);
  const invoiceHtml = await invoice.text();
  assert.match(invoiceHtml, /Invoice header/);
  assert.match(invoiceHtml, /Billing &amp; shipping/);
  assert.match(invoiceHtml, /Transaction lines/);
});

test("keeps the frontend foundation documented and modular", async () => {
  const [page, layout, resourcePage, resourceForm, datePicker, select, toast, packageJson, agents, frontend, accountingRules] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
      readFile(new URL("../features/resources/resource-page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../features/resources/resource-form-page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/ui/date-picker.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/ui/select.tsx", import.meta.url), "utf8"),
      readFile(new URL("../components/ui/toast.tsx", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
      readFile(new URL("../../../AGENTS.md", import.meta.url), "utf8"),
      readFile(new URL("../../../docs/FRONTEND.md", import.meta.url), "utf8"),
      readFile(
        new URL("../../../docs/ACCOUNTING-RULES.md", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(page, /features\/dashboard\/components\/dashboard-page/);
  assert.match(layout, /Al-Furat System/);
  assert.match(resourcePage, /> Delete<\/button>/);
  assert.match(resourcePage, /<Printer/);
  assert.match(resourcePage, /Export completed/);
  assert.match(resourceForm, /safeParse/);
  assert.match(resourceForm, /components\/ui\/date-picker/);
  assert.match(datePicker, /react-day-picker/);
  assert.match(select, /@radix-ui\/react-select/);
  assert.match(toast, /CheckCircle2/);
  assert.match(toast, /AlertCircle/);
  assert.match(packageJson, /"name": "@al-furat\/web"/);
  assert.doesNotMatch(packageJson, /"recharts"/);
  assert.match(packageJson, /"react-hook-form"/);
  assert.match(packageJson, /"zod"/);
  assert.match(agents, /frontend-first/i);
  assert.match(frontend, /Directory structure/);
  assert.match(accountingRules, /total debit equals total credit/i);
});

test("renders the dashboard period control and complete header menus", async () => {
  const dashboard = await render("/");
  const dashboardHtml = await dashboard.text();
  assert.match(dashboardHtml, /Dashboard period/);
  assert.match(dashboardHtml, /Apply period/);

  const shell = await readFile(new URL("../components/layout/app-shell.tsx", import.meta.url), "utf8");
  for (const workspaceName of ["Sales","Debts","Purchasing","Banking","Inventory","Accounting","Projects","Payroll","Reports","Import","Settings"]) {
    assert.match(shell, new RegExp(`\\[\"${workspaceName}\"`), workspaceName);
  }
  assert.match(shell, /View all notifications/);
  assert.match(shell, /My profile/);
  assert.match(shell, /Close open menu/);
});

test("supports modal quick-add for entity dropdowns without leaving the form", async () => {
  const [select, resourceForm] = await Promise.all([
    readFile(new URL("../components/ui/select.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/resources/resource-form-page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(select, /Add new \{addNewLabel\}/);
  assert.match(select, /The current transaction stays open behind this window/);
  assert.match(select, /Save & select/);
  assert.match(select, /aria-modal="true"/);
  assert.match(resourceForm, /supportsQuickAdd/);
  assert.match(resourceForm, /allowAddNew=\{supportsQuickAdd\(field\)\}/);
});

test("uses the shared delete confirmation dialog for every destructive record action", async () => {
  const [dialog, resourcePage, detailsPage, formPage] = await Promise.all([
    readFile(new URL("../components/ui/confirm-delete-dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/resources/resource-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/resources/resource-details-page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../features/resources/resource-form-page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /Delete permanently/);
  assert.match(dialog, /Keep record/);
  for (const source of [resourcePage, detailsPage, formPage]) {
    assert.match(source, /ConfirmDeleteDialog/);
    assert.doesNotMatch(source, /window\.confirm/);
  }
});
