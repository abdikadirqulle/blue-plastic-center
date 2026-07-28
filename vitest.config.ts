import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    projects: [
      "apps/api/vitest.unit.config.ts",
      "apps/api/vitest.integration.config.ts",
      "apps/web/vitest.config.ts",
      "packages/types/vitest.config.ts",
    ],
    reporters: ["default"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      reportsDirectory: "./coverage",
      exclude: [
        "**/dist/**",
        "**/coverage/**",
        "**/*.config.*",
        "**/src/index.ts",
        "**/tests/**",
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
})
