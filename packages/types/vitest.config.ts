import { defineProject } from "vitest/config"

export default defineProject({
  test: {
    name: "shared-contracts",
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
})
