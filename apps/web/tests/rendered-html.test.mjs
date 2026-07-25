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
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("server-renders every primary workspace and dedicated sales page", async () => {
  const expected = {
    "/sales/invoices": "Invoices",
    "/sales/customers": "Customers",
    "/sales/estimates": "Estimates",
    "/sales/sales-orders": "Sales orders",
    "/sales/payments": "Payments",
    "/sales/credit-notes": "Credit notes",
    "/purchasing/bills": "Vendor bills",
    "/banking/accounts": "Bank &amp; cash accounts",
    "/inventory/items": "Items &amp; services",
    "/accounting/chart-of-accounts": "Chart of accounts",
    "/projects/projects": "Projects",
    "/payroll/pay-runs": "Pay runs",
    "/reports/financial": "Financial reports",
    "/settings/company": "Company profile",
    "/login": "Sign in to your workspace",
  };

  for (const [pathname, title] of Object.entries(expected)) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), new RegExp(title), pathname);
  }
});

test("keeps the frontend foundation documented and modular", async () => {
  const [page, layout, packageJson, agents, frontend, accountingRules] =
    await Promise.all([
      readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
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
  assert.match(packageJson, /"name": "@al-furat\/web"/);
  assert.doesNotMatch(packageJson, /"recharts"/);
  assert.match(packageJson, /"react-hook-form"/);
  assert.match(packageJson, /"zod"/);
  assert.match(agents, /frontend-first/i);
  assert.match(frontend, /Directory structure/);
  assert.match(accountingRules, /total debit equals total credit/i);
});
