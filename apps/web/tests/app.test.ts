import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { expect, test } from "vitest";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("uses a React and Vite browser entry point", async () => {
  const [packageJson, index, main] = await Promise.all([
    read("../package.json"),
    read("../index.html"),
    read("../src/main.tsx"),
  ]);
  const manifest = JSON.parse(packageJson);

  expect(manifest.scripts.build).toBe("vite build");
  expect(manifest.dependencies["react-router-dom"]).toBeTruthy();
  expect(manifest.dependencies["@tanstack/react-query"]).toBeTruthy();
  expect(manifest.dependencies.next).toBeUndefined();
  expect(manifest.dependencies.vinext).toBeUndefined();
  expect(index).toMatch(/<div id="root"><\/div>/);
  expect(main).toMatch(/createRoot/);
  expect(main).toMatch(/BrowserRouter/);
});

test("declares every application route in one router", async () => {
  const app = await read("../src/app.tsx");
  for (const route of [
    "/login",
    "/import",
    "/notifications",
    "/profile",
    "/trash",
    "/:section/:resource/new",
    "/:section/:resource/:id",
    "/:section/:resource",
    "/:section",
  ]) {
    expect(app).toMatch(new RegExp(route.replaceAll("/", "\\/")));
  }
});

test("uses the live REST API and React Query integration", async () => {
  const [env, example, sales, main, trash] = await Promise.all([
    read("../lib/env.ts"),
    read("../.env.example"),
    read("../features/sales/services/sales-service.ts"),
    read("../src/main.tsx"),
    read("../features/trash/trash-page.tsx"),
  ]);
  expect(env).toMatch(/import\.meta\.env\.VITE_API_URL/);
  expect(example).toMatch(/VITE_DATA_SOURCE=api/);
  expect(sales).toMatch(/ApiSalesRepository/);
  expect(main).toMatch(/QueryClientProvider/);
  expect(trash).toMatch(/apiClient\.restore/);
  expect(`${env}\n${sales}`).not.toMatch(/NEXT_PUBLIC|process\.env/);
});

test("details never fabricate missing database values and line items use searchable selects", async () => {
  const [details, form, select] = await Promise.all([
    read("../features/resources/resource-details-page.tsx"),
    read("../features/resources/resource-form-page.tsx"),
    read("../components/ui/select.tsx"),
  ])

  expect(details).not.toMatch(/accounts@blueplastic\.example/)
  expect(details).not.toMatch(/Maka Al Mukarama Road/)
  expect(details).not.toMatch(/Verified against the original transaction/)
  expect(details).toMatch(/recordIdentifier/)
  expect(details).toMatch(/references\.resolve/)
  expect(form).toMatch(/options=\{lineReferenceOptions\}/)
  expect(form).toMatch(/\{ itemId: line\.item \}/)
  expect(form).toMatch(/item\?\.data\.salesPrice/)
  expect(form).toMatch(/item\?\.data\.unit/)
  expect(form).toMatch(/onCreateOption=\{references\.createOption\}/)
  expect(form).toMatch(/Select at least one item or account/)
  expect(select).toMatch(/Search options/)
  expect(select).toMatch(/quickAddKind === "item"/)
  expect(select).toMatch(/Sales price/)
})

test("transaction and item forms use safe defaults and account references", async () => {
  const [form, config, references] = await Promise.all([
    read("../features/resources/resource-form-page.tsx"),
    read("../features/resources/resource-config.ts"),
    read("../features/resources/reference-data.ts"),
  ])

  expect(form).toMatch(/dueDate\.setDate\(dueDate\.getDate\(\) \+ 30\)/)
  expect(form).toMatch(/return \[field\.name, "USD"\]/)
  expect(form).toMatch(/accountOptionsFor\(field\.name\)\[0\]/)
  expect(config).toMatch(/name: "incomeAccountId"[\s\S]*type: "select"/)
  expect(config).toMatch(/name: "expenseAccountId"[\s\S]*type: "select"/)
  expect(config).toMatch(/name: "inventoryAccountId"[\s\S]*type: "select"/)
  expect(config).toMatch(/Auto-generated when saved/)
  expect(references).toMatch(/"cost-of-goods-sold"/)
  expect(references).toMatch(/apiClient\.create\("inventory", "items"/)
  expect(references).toMatch(/apiClient\.create\("accounting", "chart-of-accounts"/)
})

test("table toolbars provide modal filters and working export formats", async () => {
  const [toolbar, actions, resources, sales, operations, enterprise] = await Promise.all([
    read("../components/ui/table-toolbar.tsx"),
    read("../components/ui/row-action-menu.tsx"),
    read("../features/resources/resource-page.tsx"),
    read("../features/sales/components/sales-workspace-page.tsx"),
    read("../features/operations/components/operations-workspace-page.tsx"),
    read("../features/enterprise/components/enterprise-workspace-page.tsx"),
  ])

  expect(toolbar).toMatch(/Export as PDF/)
  expect(toolbar).toMatch(/Export as Excel/)
  expect(toolbar).toMatch(/window\.print\(\)/)
  expect(toolbar).toMatch(/role="dialog"/)
  expect(toolbar).toMatch(/activeFilterCount/)
  for (const page of [resources, sales, operations, enterprise])
    expect(page).toMatch(/<TableToolbar/)
  expect(actions).toMatch(/createPortal/)
  expect(actions).toMatch(/View details/)
  expect(actions).toMatch(/Edit/)
  expect(actions).toMatch(/Delete/)
  expect(sales).toMatch(/<RowActionMenu/)
})
