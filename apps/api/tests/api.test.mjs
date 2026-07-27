import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../dist/app.js";
import { MemoryResourceRepository } from "../dist/repositories/memory-resource-repository.js";

const auth = {
  Authorization: "Bearer admin-demo-token",
  "X-Company-Id": "00000000-0000-4000-8000-000000000001",
  "X-Branch-Id": "00000000-0000-4000-8000-000000000011",
};

async function inject(app, path, init = {}) {
  const response = await app.inject({
    method: init.method ?? "GET",
    url: path,
    headers: {
      ...auth,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    payload: init.body,
  });
  return Object.assign(response, { status: response.statusCode });
}

const request = (app, path, init = {}) => inject(app, path, init);

test("health and module metadata expose the backend platform", async () => {
  const app = createApp();
  const health = await inject(app, "/health", { headers: {} });
  assert.equal(health.status, 200);
  assert.equal((await health.json()).data.status, "healthy");

  const metadata = await request(app, "/v1/meta/modules");
  assert.equal(metadata.status, 200);
  const body = await metadata.json();
  for (const moduleName of ["sales", "debts", "purchasing", "banking", "inventory", "accounting", "projects", "payroll"]) {
    assert.ok(body.data[moduleName], moduleName);
  }
});

test("authentication, RBAC, required fields, and tenant isolation are enforced", async () => {
  const app = createApp();
  assert.equal((await inject(app, "/v1/sales/customers", { headers: { Authorization: "" } })).status, 401);

  const invalid = await request(app, "/v1/sales/customers", {
    method: "POST",
    body: JSON.stringify({ data: {} }),
  });
  assert.equal(invalid.status, 422);

  const forbidden = await request(app, "/v1/sales/customers", {
    method: "POST",
    headers: { Authorization: "Bearer viewer-demo-token" },
    body: JSON.stringify({ data: { displayName: "Blocked Customer" } }),
  });
  assert.equal(forbidden.status, 403);

  const created = await request(app, "/v1/sales/customers", {
    method: "POST",
    body: JSON.stringify({ status: "active", data: { displayName: "Banaadir Trading Co.", email: "accounts@banaadir.example" } }),
  });
  assert.equal(created.status, 201);

  const otherTenant = await request(app, "/v1/sales/customers", {
    headers: { "X-Company-Id": "00000000-0000-4000-8000-000000000099" },
  });
  assert.equal((await otherTenant.json()).meta.total, 0);
});

test("CRUD supports pagination, search, optimistic locking, soft deletion, and audit", async () => {
  const repository = new MemoryResourceRepository();
  const app = createApp(repository);
  const create = await request(app, "/v1/inventory/items", {
    method: "POST",
    body: JSON.stringify({ status: "active", data: { name: "Cement 50kg", type: "inventory", sku: "CEM-50" } }),
  });
  const record = (await create.json()).data;

  const list = await request(app, "/v1/inventory/items?search=cement&page=1&pageSize=10");
  const listBody = await list.json();
  assert.equal(listBody.meta.total, 1);
  assert.equal(listBody.data[0].data.sku, "CEM-50");

  const stale = await request(app, `/v1/inventory/items/${record.id}`, {
    method: "PATCH",
    body: JSON.stringify({ version: 99, data: { name: "Stale" } }),
  });
  assert.equal(stale.status, 409);

  const updated = await request(app, `/v1/inventory/items/${record.id}`, {
    method: "PATCH",
    body: JSON.stringify({ version: 1, data: { name: "Cement 50kg Premium" } }),
  });
  assert.equal((await updated.json()).data.version, 2);

  const removed = await request(app, `/v1/inventory/items/${record.id}`, { method: "DELETE" });
  assert.equal(removed.status, 204);
  assert.equal((await request(app, `/v1/inventory/items/${record.id}`)).status, 404);

  const audit = await request(app, "/v1/audit-events");
  assert.deepEqual((await audit.json()).data.map((event) => event.action), ["delete", "update", "create"]);
});

test("journal entries must balance before creation and posting", async () => {
  const app = createApp();
  const unbalanced = await request(app, "/v1/accounting/journal-entries", {
    method: "POST",
    body: JSON.stringify({ data: { journalDate: "2026-07-26", lines: [{ accountId: "cash", debit: "100" }, { accountId: "sales", credit: "90" }] } }),
  });
  assert.equal(unbalanced.status, 422);

  const balanced = await request(app, "/v1/accounting/journal-entries", {
    method: "POST",
    body: JSON.stringify({ data: { journalDate: "2026-07-26", lines: [{ accountId: "cash", debit: "100" }, { accountId: "sales", credit: "100" }] } }),
  });
  assert.equal(balanced.status, 201);
  const journal = (await balanced.json()).data;

  const posted = await request(app, `/v1/accounting/journal-entries/${journal.id}/post`, { method: "POST" });
  assert.equal((await posted.json()).data.status, "posted");
  assert.equal((await request(app, `/v1/accounting/journal-entries/${journal.id}`, { method: "DELETE" })).status, 409);
});

test("report generation and bulk import validation endpoints respond with jobs", async () => {
  const app = createApp();
  const report = await request(app, "/v1/reports/profit-and-loss/run", {
    method: "POST",
    body: JSON.stringify({ from: "2026-07-01", to: "2026-07-31", basis: "accrual", currency: "USD" }),
  });
  assert.equal(report.status, 201);
  assert.equal((await report.json()).data.status, "generated");

  const imported = await request(app, "/v1/imports", {
    method: "POST",
    body: JSON.stringify({ module: "sales", resource: "customers", rows: [{ displayName: "New Customer" }], dryRun: true }),
  });
  assert.equal(imported.status, 202);
  assert.equal((await imported.json()).data.status, "validated");
});
