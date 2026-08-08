import { describe, expect, it } from "vitest"
import {
  requireExactlyOneOpenFiscalPeriod,
  type FiscalPeriodCandidate,
} from "../../src/modules/accounting/fiscal-period-resolver.js"

const companyId = "00000000-0000-4000-8000-000000000001"
const otherCompanyId = "00000000-0000-4000-8000-000000000002"

const period = (
  overrides: Partial<FiscalPeriodCandidate> = {},
): FiscalPeriodCandidate => ({
  id: "period-july",
  companyId,
  name: "July 2026",
  startDate: new Date("2026-07-01T00:00:00.000Z"),
  endDate: new Date("2026-07-31T00:00:00.000Z"),
  status: "open",
  ...overrides,
})

describe("fiscal period resolution", () => {
  it("returns the single open company period and its persisted ID", () => {
    expect(requireExactlyOneOpenFiscalPeriod(
      [period()],
      companyId,
      new Date("2026-07-15T00:00:00.000Z"),
    ).id).toBe("period-july")
  })

  it("rejects a missing period", () => {
    expect(() => requireExactlyOneOpenFiscalPeriod(
      [],
      companyId,
      new Date("2026-08-01T00:00:00.000Z"),
    )).toThrow("No fiscal period exists")
  })

  it("rejects a matching closed period", () => {
    expect(() => requireExactlyOneOpenFiscalPeriod(
      [period({ status: "closed" })],
      companyId,
      new Date("2026-07-15T00:00:00.000Z"),
    )).toThrow("is not open")
  })

  it("rejects overlapping matching periods", () => {
    expect(() => requireExactlyOneOpenFiscalPeriod(
      [period(), period({ id: "period-q3", name: "Q3 2026" })],
      companyId,
      new Date("2026-07-15T00:00:00.000Z"),
    )).toThrow("Multiple fiscal periods match")
  })

  it("does not accept another company's matching period", () => {
    expect(() => requireExactlyOneOpenFiscalPeriod(
      [period({ companyId: otherCompanyId })],
      companyId,
      new Date("2026-07-15T00:00:00.000Z"),
    )).toThrow("No fiscal period exists")
  })

  it.each([
    "2026-07-01T00:00:00.000Z",
    "2026-07-31T00:00:00.000Z",
  ])("includes boundary date %s", (date) => {
    expect(requireExactlyOneOpenFiscalPeriod(
      [period()],
      companyId,
      new Date(date),
    ).id).toBe("period-july")
  })

  it("applies the same rule to a reversal effective date", () => {
    const reversalDate = new Date("2026-08-01T00:00:00.000Z")
    expect(() => requireExactlyOneOpenFiscalPeriod(
      [period()],
      companyId,
      reversalDate,
    )).toThrow("No fiscal period exists")
  })
})
