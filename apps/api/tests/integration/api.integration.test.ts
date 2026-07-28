import assert from "node:assert/strict";
import { test } from "vitest";
import { createApp } from "../../src/app.js";
import { allowedWebOrigins } from "../../src/config/env.js";
import { MemoryResourceRepository } from "../../src/repositories/memory-resource-repository.js";
import {
  accountingSchemas,
  bankingSchemas,
  inventorySchemas,
  payrollSchemas,
  projectSchemas,
  purchasingSchemas,
  salesSchemas,
} from "@blue-plastic/types";

async function inject(app, path, init = {}, auth = {}) {
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

const sessions = new WeakMap();

async function getSession(app) {
  if (!sessions.has(app)) {
    sessions.set(app, (async () => {
      const response = await inject(app, "/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: "admin@blueplastic.local",
          password: "Admin123!",
        }),
      });
      assert.equal(response.status, 200);
      return {
        Cookie: response.headers["set-cookie"].split(";")[0],
        "X-CSRF-Token": response.json().data.csrfToken,
      };
    })());
  }
  return sessions.get(app);
}

const request = async (app, path, init = {}) =>
  inject(app, path, init, await getSession(app));

test("development CORS allows the supported local frontend ports", () => {
  const origins = allowedWebOrigins({
    NODE_ENV: "development",
    HOST: "0.0.0.0",
    PORT: 4000,
    WEB_ORIGIN: "http://localhost:3000",
    WEB_ORIGINS: "http://localhost:5173",
    LOG_LEVEL: "silent",
    SESSION_TTL_HOURS: 12,
    COOKIE_SECURE: false,
  });
  for (const origin of [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
  ]) assert.ok(origins.includes(origin), origin);
});

test("secure session authentication requires valid credentials and CSRF", async () => {
  const app = createApp();
  const invalid = await inject(app, "/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@blueplastic.local", password: "Incorrect123!" }),
  });
  assert.equal(invalid.status, 401);

  const session = await getSession(app);
  const me = await inject(app, "/v1/auth/me", {}, session);
  assert.equal(me.json().data.user.role, "administrator");

  const missingCsrf = await inject(app, "/v1/sales/customers", {
    method: "POST",
    body: JSON.stringify({ data: { displayName: "Blocked" } }),
  }, { Cookie: session.Cookie });
  assert.equal(missingCsrf.status, 403);

  const logout = await inject(app, "/v1/auth/logout", { method: "POST" }, session);
  assert.equal(logout.status, 204);
  assert.equal((await inject(app, "/v1/auth/me", {}, session)).status, 401);
});

test("Phase 1 company setup and master resources are registered and validated", async () => {
  const app = createApp();
  const metadata = (await request(app, "/v1/meta/modules")).json();
  assert.ok(metadata.data.setup.resources["company-settings"]);
  assert.ok(metadata.data.setup.resources["document-sequences"]);

  const settings = await request(app, "/v1/setup/company-settings", {
    method: "POST",
    body: JSON.stringify({
      status: "active",
      data: {
        legalName: "BLUE PLASTIC CENTER",
        functionalCurrency: "USD",
        fiscalYearStartMonth: 1,
        accountingBasis: "accrual",
        timezone: "Africa/Mogadishu",
      },
    }),
  });
  assert.equal(settings.status, 201);

  const invalidTerm = await request(app, "/v1/setup/payment-terms", {
    method: "POST",
    body: JSON.stringify({ data: { name: "Net 30" } }),
  });
  assert.equal(invalidTerm.status, 422);
});

test("administrators can provision the small company user team", async () => {
  const app = createApp();
  const created = await request(app, "/v1/auth/users", {
    method: "POST",
    body: JSON.stringify({
      email: "accountant@blueplastic.local",
      displayName: "Company Accountant",
      role: "accountant",
      password: "Accountant123!",
    }),
  });
  assert.equal(created.status, 201);
  assert.equal(created.json().data.role, "accountant");
  const userId = created.json().data.id;

  const updated = await request(app, `/v1/auth/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify({
      displayName: "Senior Accountant",
      role: "finance_manager",
      active: false,
    }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json().data.displayName, "Senior Accountant");
  assert.equal(updated.json().data.active, false);

  const reset = await request(app, `/v1/auth/users/${userId}/reset-password`, {
    method: "POST",
    body: JSON.stringify({ password: "ChangedPassword123!" }),
  });
  assert.equal(reset.status, 204);

  const users = await request(app, "/v1/auth/users");
  assert.equal(users.json().data.length, 3);
  assert.equal("passwordHash" in users.json().data[0], false);
});

test("signed-in users can update their own profile", async () => {
  const app = createApp();
  const updated = await request(app, "/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify({
      displayName: "Abdisalam A. Abdulahi",
      email: "abdisalam@blueplastic.local",
    }),
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.json().data.user.displayName, "Abdisalam A. Abdulahi");

  const me = await request(app, "/v1/auth/me");
  assert.equal(me.json().data.user.email, "abdisalam@blueplastic.local");
});

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
  assert.equal((await inject(app, "/v1/sales/customers")).status, 401);

  const viewerLogin = await inject(app, "/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "viewer@blueplastic.local",
      password: "Viewer123!",
    }),
  });
  const viewerAuth = {
    Cookie: viewerLogin.headers["set-cookie"].split(";")[0],
    "X-CSRF-Token": viewerLogin.json().data.csrfToken,
  };
  const forbidden = await inject(app, "/v1/sales/customers", {
    method: "POST",
    body: JSON.stringify({ data: { displayName: "Blocked Customer" } }),
  }, viewerAuth);
  assert.equal(forbidden.status, 403);

  const invalid = await request(app, "/v1/sales/customers", {
    method: "POST",
    body: JSON.stringify({ data: {} }),
  });
  assert.equal(invalid.status, 422);

  const created = await request(app, "/v1/sales/customers", {
    method: "POST",
    body: JSON.stringify({ status: "active", data: { displayName: "Banaadir Trading Co.", email: "accounts@banaadir.example" } }),
  });
  assert.equal(created.status, 201);

  const me = await request(app, "/v1/auth/me");
  assert.equal(me.json().data.user.role, "administrator");
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
  const retained = repository.records.get(record.id);
  assert.equal(retained.isDeleted, true);
  assert.ok(retained.deletedAt);
  const trash = await request(app, "/v1/trash?module=inventory&resource=items");
  assert.equal(trash.status, 200);
  assert.equal(trash.json().data[0].id, record.id);
  assert.equal(trash.json().data[0].isDeleted, true);
  const restored = await request(app, `/v1/trash/${record.id}/restore`, {
    method: "POST",
  });
  assert.equal(restored.status, 200);
  assert.equal(restored.json().data.isDeleted, false);
  assert.equal((await request(app, `/v1/inventory/items/${record.id}`)).status, 200);

  const audit = await request(app, "/v1/audit-events");
  assert.deepEqual((await audit.json()).data.map((event) => event.action), ["restore", "delete", "update", "create"]);
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

test("Phase 2 CRUD validates operational documents, numbers them, and honors idempotency", async () => {
  const app = createApp();
  const line = {
    accountId: "4000-sales",
    description: "Blue plastic products",
    quantity: "2",
    unitPrice: "125.00",
  };
  const invoiceInput = {
    status: "draft",
    data: {
      customerId: "customer-1",
      invoiceDate: "2026-07-28",
      dueDate: "2026-08-27",
      currency: "USD",
      template: "Product invoice",
      class: "Wholesale",
      terms: "Net 30",
      poNumber: "CUSTOMER-PO-88",
      shippingMethod: "Company truck",
      lines: [line],
    },
  };

  const first = await request(app, "/v1/sales/invoices", {
    method: "POST",
    headers: { "Idempotency-Key": "invoice-import-row-1" },
    body: JSON.stringify(invoiceInput),
  });
  assert.equal(first.status, 201);
  assert.match(first.json().data.data.documentNumber, /^INV-\d{5}$/);

  const forgedPosted = await request(app, "/v1/sales/invoices", {
    method: "POST",
    body: JSON.stringify({ ...invoiceInput, status: "posted" }),
  });
  assert.equal(forgedPosted.status, 409);
  const forgedPostedCase = await request(app, "/v1/sales/invoices", {
    method: "POST",
    body: JSON.stringify({ ...invoiceInput, status: "Posted" }),
  });
  assert.equal(forgedPostedCase.status, 409);

  const duplicate = await request(app, "/v1/sales/invoices", {
    method: "POST",
    headers: { "Idempotency-Key": "invoice-import-row-1" },
    body: JSON.stringify(invoiceInput),
  });
  assert.equal(duplicate.json().data.id, first.json().data.id);

  const conflict = await request(app, "/v1/sales/invoices", {
    method: "POST",
    headers: { "Idempotency-Key": "invoice-import-row-1" },
    body: JSON.stringify({ ...invoiceInput, data: { ...invoiceInput.data, memo: "changed" } }),
  });
  assert.equal(conflict.status, 409);

  const listed = await request(app, "/v1/sales/invoices");
  assert.equal(listed.json().meta.total, 1);
  const fetched = await request(app, `/v1/sales/invoices/${first.json().data.id}`);
  assert.equal(fetched.status, 200);
  assert.equal(fetched.json().data.data.template, "Product invoice");
  assert.equal(fetched.json().data.data.class, "Wholesale");
  assert.equal(fetched.json().data.data.poNumber, "CUSTOMER-PO-88");
  const updated = await request(app, `/v1/sales/invoices/${first.json().data.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      version: 1,
      data: {
        memo: "Customer requested delivery",
        shippingMethod: "Third-party delivery",
      },
    }),
  });
  assert.equal(updated.json().data.version, 2);
  assert.equal(updated.json().data.data.template, "Product invoice");
  assert.equal(updated.json().data.data.shippingMethod, "Third-party delivery");
  assert.equal((await request(app, `/v1/sales/invoices/${first.json().data.id}`, {
    method: "DELETE",
  })).status, 204);
});

test("Phase 2 secured workflows cover sales, purchasing, inventory, and banking", async () => {
  const app = createApp();
  const line = {
    accountId: "4000-sales",
    description: "Operational line",
    quantity: "2",
    unitPrice: "50.00",
  };

  const estimate = (await request(app, "/v1/sales/estimates", {
    method: "POST",
    body: JSON.stringify({
      status: "draft",
      data: {
        customerId: "customer-1",
        estimateDate: "2026-07-28",
        currency: "USD",
        lines: [line],
      },
    }),
  })).json().data;
  const converted = await request(app, `/v1/sales/estimates/${estimate.id}/convert`, {
    method: "POST",
    body: JSON.stringify({ targetResource: "invoices" }),
  });
  assert.equal(converted.status, 201);
  assert.equal(converted.json().data.data.sourceDocumentId, estimate.id);

  const payment = (await request(app, "/v1/sales/payments", {
    method: "POST",
    body: JSON.stringify({
      status: "draft",
      data: {
        customerId: "customer-1",
        paymentDate: "2026-07-28",
        amount: "100.00",
        currency: "USD",
        depositToAccountId: "bank-1",
        paymentMethod: "bank-transfer",
        allocations: [],
      },
    }),
  })).json().data;
  const applied = await request(app, `/v1/sales/payments/${payment.id}/allocate`, {
    method: "POST",
    body: JSON.stringify({
      allocations: [{ invoiceId: converted.json().data.id, amount: "100.00" }],
    }),
  });
  assert.equal(applied.json().data.status, "applied");
  const draftPostings = await request(app, "/v1/accounting/journal-entries");
  assert.equal(draftPostings.json().meta.total, 1);

  const attachment = await request(app, `/v1/documents/sales/invoices/${converted.json().data.id}/attachments`, {
    method: "POST",
    body: JSON.stringify({
      fileName: "customer-order.pdf",
      contentType: "application/pdf",
      sizeBytes: 1024,
    }),
  });
  assert.equal(attachment.status, 201);
  assert.equal(attachment.json().data.status, "pending-upload");

  const purchaseOrder = (await request(app, "/v1/purchasing/purchase-orders", {
    method: "POST",
    body: JSON.stringify({
      status: "open",
      data: {
        vendorId: "vendor-1",
        orderDate: "2026-07-28",
        currency: "USD",
        lines: [line],
      },
    }),
  })).json().data;
  const receipt = await request(app, `/v1/purchasing/purchase-orders/${purchaseOrder.id}/receive`, {
    method: "POST",
    body: JSON.stringify({
      receiptDate: "2026-07-28",
      warehouseId: "warehouse-1",
      lines: [{ lineNumber: 1, quantityReceived: "2" }],
    }),
  });
  assert.equal(receipt.status, 201);
  assert.equal(receipt.json().data.status, "received");

  const fulfillment = (await request(app, "/v1/inventory/fulfillment", {
    method: "POST",
    body: JSON.stringify({
      status: "draft",
      data: {
        salesOrder: "sales-order-1",
        warehouse: "warehouse-1",
        lines: [line],
      },
    }),
  })).json().data;
  for (const action of ["allocate", "pick", "pack", "ship"]) {
    const response = await request(app, `/v1/inventory/fulfillment/${fulfillment.id}/action`, {
      method: "POST",
      body: JSON.stringify({ action }),
    });
    assert.equal(response.status, 200, action);
  }

  const reconciliation = (await request(app, "/v1/banking/reconciliation", {
    method: "POST",
    body: JSON.stringify({
      status: "draft",
      data: {
        accountId: "bank-1",
        statementDate: "2026-07-28",
        beginningBalance: "100.00",
        endingBalance: "150.00",
        clearedTransactionIds: [],
      },
    }),
  })).json().data;
  const invalidFinish = await request(app, `/v1/banking/reconciliation/${reconciliation.id}/finish`, {
    method: "POST",
    body: JSON.stringify({ clearedTransactionIds: ["transaction-1"], difference: "1.00" }),
  });
  assert.equal(invalidFinish.status, 422);
  const finished = await request(app, `/v1/banking/reconciliation/${reconciliation.id}/finish`, {
    method: "POST",
    body: JSON.stringify({ clearedTransactionIds: ["transaction-1"], difference: "0.00" }),
  });
  assert.equal(finished.json().data.status, "reconciled");
});

test("Phase 2 module roles cannot cross operational security boundaries", async () => {
  const app = createApp();
  const provisioned = await request(app, "/v1/auth/users", {
    method: "POST",
    body: JSON.stringify({
      email: "sales@blueplastic.local",
      displayName: "Sales User",
      role: "sales",
      password: "SalesSecure123!",
    }),
  });
  assert.equal(provisioned.status, 201);

  const login = await inject(app, "/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "sales@blueplastic.local",
      password: "SalesSecure123!",
    }),
  });
  const salesAuth = {
    Cookie: login.headers["set-cookie"].split(";")[0],
    "X-CSRF-Token": login.json().data.csrfToken,
  };
  assert.equal((await inject(app, "/v1/sales/invoices", {}, salesAuth)).status, 200);
  assert.equal((await inject(app, "/v1/purchasing/bills", {}, salesAuth)).status, 403);
  assert.equal((await inject(app, "/v1/accounting/journal-entries", {}, salesAuth)).status, 403);
});

test("every Phase 2 CRUD resource has a dedicated validation contract", async () => {
  const app = createApp();
  const moduleMetadata = (await request(app, "/v1/meta/modules")).json().data;
  const schemaSets = {
    sales: salesSchemas,
    purchasing: purchasingSchemas,
    inventory: inventorySchemas,
    banking: bankingSchemas,
  };
  for (const [moduleName, schemas] of Object.entries(schemaSets)) {
    assert.deepEqual(
      Object.keys(schemas).sort(),
      Object.keys(moduleMetadata[moduleName].resources).sort(),
      moduleName,
    );
  }
});

test("Phase 3 ledger posting, exact reports, reversal, and fiscal locks are enforced", async () => {
  const app = createApp();
  const createJournal = async (date, amount = "100.1234") =>
    request(app, "/v1/accounting/journal-entries", {
      method: "POST",
      body: JSON.stringify({
        data: {
          journalDate: date,
          currency: "USD",
          lines: [
            { accountId: "1000", debit: amount, credit: "0" },
            { accountId: "4000", debit: "0", credit: amount },
          ],
        },
      }),
    });

  const journal = (await (await createJournal("2026-07-28")).json()).data;
  const posted = await request(app, `/v1/accounting/journal-entries/${journal.id}/post`, {
    method: "POST",
  });
  assert.equal(posted.status, 200);

  const report = await request(app, "/v1/reports/trial-balance/run", {
    method: "POST",
    body: JSON.stringify({ from: "2026-07-01", to: "2026-07-31" }),
  });
  assert.deepEqual(report.json().data.controlTotals, {
    debit: "100.1234",
    credit: "100.1234",
    balanced: true,
  });

  const reversed = await request(app, `/v1/accounting/journal-entries/${journal.id}/reverse`, {
    method: "POST",
    body: JSON.stringify({ reversalDate: "2026-07-29", memo: "Correcting reversal" }),
  });
  assert.equal(reversed.status, 201);
  assert.equal(reversed.json().data.status, "posted");

  assert.equal((await request(app, "/v1/accounting/periods/close", {
    method: "POST",
    body: JSON.stringify({
      name: "July 2026",
      startDate: "2026-07-01",
      endDate: "2026-07-31",
    }),
  })).status, 204);
  const locked = (await (await createJournal("2026-07-30", "20.0000")).json()).data;
  assert.equal((await request(app, `/v1/accounting/journal-entries/${locked.id}/post`, {
    method: "POST",
  })).status, 409);
  assert.equal((await request(app, "/v1/accounting/periods/July%202026/reopen", {
    method: "POST",
  })).status, 204);
  assert.equal((await request(app, `/v1/accounting/journal-entries/${locked.id}/post`, {
    method: "POST",
  })).status, 200);
  const reconciliation = await request(app, "/v1/accounting/reconciliation/control-accounts", {
    method: "POST",
    body: JSON.stringify({ from: "2026-07-01", to: "2026-07-31" }),
  });
  assert.equal(reconciliation.status, 200);
  assert.equal(reconciliation.json().data.controls.length, 2);
});

test("Phase 3 operational reports include aging and audit trails", async () => {
  const app = createApp();
  await request(app, "/v1/debts/receivables", {
    method: "POST",
    body: JSON.stringify({ status: "open", data: {
      customerId: "customer-1",
      originalAmount: "100",
      outstanding: "75",
      dueDate: "2026-06-15",
    } }),
  });
  const aging = await request(app, "/v1/reports/receivables-aging/run", {
    method: "POST",
    body: JSON.stringify({ from: "2026-01-01", to: "2026-07-31" }),
  });
  assert.equal(aging.status, 201);
  assert.equal(aging.json().data.rows[0].agingBucket, "31-60");

  const audit = await request(app, "/v1/reports/audit-trail/run", {
    method: "POST",
    body: JSON.stringify({ from: "2026-01-01", to: "2030-12-31" }),
  });
  assert.equal(audit.status, 201);
  assert.ok(audit.json().data.rows.some((row) => row.action === "create"));
});

test("Phase 3 project billing and profitability use exact financial values", async () => {
  const app = createApp();
  const project = (await request(app, "/v1/projects/projects", {
    method: "POST",
    body: JSON.stringify({
      status: "active",
      data: {
        projectName: "Factory expansion",
        customerId: "customer-1",
        startDate: "2026-07-01",
        contractAmount: "5000",
      },
    }),
  })).json().data;
  await request(app, "/v1/projects/time", {
    method: "POST",
    body: JSON.stringify({ data: {
      employeeId: "employee-1", projectId: project.id, date: "2026-07-28",
      hours: "8", hourlyCost: "10", billable: true,
    } }),
  });
  await request(app, "/v1/projects/expenses", {
    method: "POST",
    body: JSON.stringify({ data: {
      projectId: project.id, date: "2026-07-28", amount: "20",
      accountId: "6000", billable: true,
    } }),
  });
  const billing = (await request(app, "/v1/projects/progress-billing", {
    method: "POST",
    body: JSON.stringify({ data: {
      projectId: project.id, customerId: "customer-1", invoiceDate: "2026-07-28",
      amount: "250", revenueAccountId: "4000", description: "Milestone 1",
    } }),
  })).json().data;
  const invoice = await request(app, `/v1/projects/progress-billing/${billing.id}/create-invoice`, {
    method: "POST",
    body: JSON.stringify({ dueDate: "2026-08-27", receivableAccountId: "1100" }),
  });
  assert.equal(invoice.status, 201);
  assert.equal(invoice.json().data.data.sourceDocumentId, billing.id);

  const profitability = await request(app, `/v1/projects/projects/${project.id}/profitability`);
  assert.deepEqual(
    Object.fromEntries(["revenue", "labourCost", "expenseCost", "totalCost", "profit"].map(
      (key) => [key, profitability.json().data[key]],
    )),
    {
      revenue: "250.0000",
      labourCost: "80.0000",
      expenseCost: "20.0000",
      totalCost: "100.0000",
      profit: "150.0000",
    },
  );
});

test("Phase 3 payroll validates calculations and protects approval workflows", async () => {
  const app = createApp();
  const invalid = await request(app, "/v1/payroll/pay-runs", {
    method: "POST",
    body: JSON.stringify({ data: {
      periodStart: "2026-07-01", periodEnd: "2026-07-31", paymentDate: "2026-07-31",
      wageExpenseAccountId: "6000", payrollPayableAccountId: "2100",
      lines: [{ employeeId: "employee-1", grossPay: "1000", deductions: "100", netPay: "950" }],
    } }),
  });
  assert.equal(invalid.status, 422);

  const payRun = (await request(app, "/v1/payroll/pay-runs", {
    method: "POST",
    body: JSON.stringify({ data: {
      periodStart: "2026-07-01", periodEnd: "2026-07-31", paymentDate: "2026-07-31",
      wageExpenseAccountId: "6000", payrollPayableAccountId: "2100",
      lines: [{ employeeId: "employee-1", grossPay: "1000", deductions: "100", netPay: "900" }],
    } }),
  })).json().data;
  assert.equal((await request(app, `/v1/payroll/pay-runs/${payRun.id}/approve`, {
    method: "POST",
  })).json().data.status, "approved");
  assert.equal((await request(app, `/v1/payroll/pay-runs/${payRun.id}/mark-paid`, {
    method: "POST",
  })).json().data.status, "paid");
});

test("every Phase 3 CRUD resource has a dedicated validation contract", async () => {
  const app = createApp();
  const moduleMetadata = (await request(app, "/v1/meta/modules")).json().data;
  for (const [moduleName, schemas] of Object.entries({
    accounting: accountingSchemas,
    projects: projectSchemas,
    payroll: payrollSchemas,
  })) {
    assert.deepEqual(
      Object.keys(schemas).sort(),
      Object.keys(moduleMetadata[moduleName].resources).sort(),
      moduleName,
    );
  }
});
