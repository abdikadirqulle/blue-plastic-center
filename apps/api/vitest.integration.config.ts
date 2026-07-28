import { defineProject } from "vitest/config"

export default defineProject({
  test: {
    name: "api-integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    fileParallelism: false,
    hookTimeout: 15_000,
    testTimeout: 15_000,
  },
})
