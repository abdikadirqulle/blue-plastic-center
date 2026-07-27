import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { URL } from "node:url";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("uses a React and Vite browser entry point", async () => {
  const [packageJson, index, main] = await Promise.all([
    read("../package.json"),
    read("../index.html"),
    read("../src/main.tsx"),
  ]);
  const manifest = JSON.parse(packageJson);

  assert.equal(manifest.scripts.build, "vite build");
  assert.ok(manifest.dependencies["react-router-dom"]);
  assert.ok(manifest.dependencies["@tanstack/react-query"]);
  assert.equal(manifest.dependencies.next, undefined);
  assert.equal(manifest.dependencies.vinext, undefined);
  assert.match(index, /<div id="root"><\/div>/);
  assert.match(main, /createRoot/);
  assert.match(main, /BrowserRouter/);
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
    assert.match(app, new RegExp(route.replaceAll("/", "\\/")));
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
  assert.match(env, /import\.meta\.env\.VITE_API_URL/);
  assert.match(example, /VITE_DATA_SOURCE=api/);
  assert.match(sales, /ApiSalesRepository/);
  assert.match(main, /QueryClientProvider/);
  assert.match(trash, /apiClient\.restore/);
  assert.doesNotMatch(`${env}\n${sales}`, /NEXT_PUBLIC|process\.env/);
});
