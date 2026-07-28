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
  expect(select).toMatch(/Search options/)
})
