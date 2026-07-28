import { defineProject } from "vitest/config"

export default defineProject({
  test: {
    name: "api-unit",
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    mockReset: true,
    restoreMocks: true,
  },
})
