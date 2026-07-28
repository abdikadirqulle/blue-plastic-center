import { operationalSchemas } from "@blue-plastic/types"
import { describe, expect, it } from "vitest"
import { modules } from "../../src/domain/modules.js"

const operationalModules = [
  "sales",
  "purchasing",
  "inventory",
  "banking",
  "accounting",
  "projects",
  "payroll",
] as const

describe("module registry", () => {
  it.each(operationalModules)("%s has one shared contract per API resource", (moduleName) => {
    expect(Object.keys(operationalSchemas[moduleName]).sort()).toEqual(
      Object.keys(modules[moduleName].resources).sort(),
    )
  })

  it("defines usable metadata for every registered module and resource", () => {
    expect(Object.keys(modules)).toEqual(expect.arrayContaining([
      "documents",
      "setup",
      "sales",
      "debts",
      "purchasing",
      "banking",
      "inventory",
      "accounting",
      "projects",
      "payroll",
    ]))

    for (const [moduleName, module] of Object.entries(modules)) {
      expect(module.name).toBe(moduleName)
      expect(module.label).not.toHaveLength(0)
      expect(Object.keys(module.resources).length).toBeGreaterThan(0)
      for (const [resourceName, resource] of Object.entries(module.resources)) {
        expect(resource.name).toBe(resourceName)
        expect(resource.requiredFields.length).toBeGreaterThan(0)
      }
    }
  })
})
