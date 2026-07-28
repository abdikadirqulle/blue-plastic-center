import { describe, expect, it } from "vitest"
import { dashboardRangeLabel } from "../features/dashboard/components/dashboard-date-range-picker"

describe("dashboard reporting period labels", () => {
  it("shows an all-time label when the dashboard is unbounded", () => {
    expect(dashboardRangeLabel({ from: "", to: "" })).toBe("All time")
  })

  it("shows a single date without duplicating it", () => {
    expect(
      dashboardRangeLabel({
        from: "2026-07-28",
        to: "2026-07-28",
      }),
    ).toBe("28 Jul 2026")
  })

  it("shows both ends of a custom reporting period", () => {
    expect(
      dashboardRangeLabel({
        from: "2026-07-01",
        to: "2026-07-28",
      }),
    ).toBe("01 Jul 2026 – 28 Jul 2026")
  })
})
