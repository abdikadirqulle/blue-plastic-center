import { describe, expect, it } from "vitest"
import {
  averageCost,
  naturalBalance,
  netPayments,
  runningLedgerBalance,
  summarizeParty,
} from "../../src/modules/read-models/balance-math.js"

describe("naturalBalance", () => {
  it("reads a debit-normal account as positive when it holds value", () => {
    expect(naturalBalance("asset", "225000", "54330")).toBe("170670.0000")
    expect(naturalBalance("expense", "4380", "0")).toBe("4380.0000")
  })

  it("reads a credit-normal account as positive when it is owed", () => {
    expect(naturalBalance("liability", "0", "12400")).toBe("12400.0000")
    expect(naturalBalance("income", "900", "250585")).toBe("249685.0000")
  })
})

describe("summarizeParty", () => {
  const documents = [
    {
      outstanding: "200.00",
      total: "200.00",
      date: "2026-01-10",
      dueDate: "2026-01-31",
      status: "open",
    },
    {
      outstanding: "150.00",
      total: "150.00",
      date: "2026-02-14",
      dueDate: "2026-03-16",
      status: "open",
    },
  ]

  it("counts what is open and what is past due", () => {
    const balance = summarizeParty(documents, "2026-02-20")

    expect(balance.openBalance).toBe("350.0000")
    expect(balance.overdueBalance).toBe("200.0000")
    expect(balance.openCount).toBe(2)
    expect(balance.lastDocumentDate).toBe("2026-02-14")
  })

  it("leaves drafts and voided documents out of the balance", () => {
    const balance = summarizeParty(
      [
        ...documents,
        { outstanding: "90.00", total: "90.00", date: "2026-02-15", status: "draft" },
        { outstanding: "80.00", total: "80.00", date: "2026-02-16", status: "voided" },
      ],
      "2026-02-20",
    )

    expect(balance.openBalance).toBe("350.0000")
    expect(balance.openCount).toBe(2)
  })
})

describe("netPayments", () => {
  const balance = {
    openBalance: "500.0000",
    overdueBalance: "200.0000",
    openCount: 2,
    lastDocumentDate: "2026-02-14",
  }

  it("reduces what is owed by the payments already recorded", () => {
    expect(netPayments(balance, ["120.00", "80.00"])).toMatchObject({
      openBalance: "300.0000",
      overdueBalance: "0.0000",
    })
  })

  it("leaves the balance alone when nothing has been paid", () => {
    expect(netPayments(balance, [])).toBe(balance)
  })

  it("shows an overpaid party in credit", () => {
    expect(netPayments(balance, ["600.00"]).openBalance).toBe("-100.0000")
  })
})

describe("averageCost", () => {
  it("divides stock value by the units carrying it", () => {
    expect(averageCost("7800", "624")).toBe("0.0800")
  })

  it("returns zero rather than dividing by no stock", () => {
    expect(averageCost("0", "0")).toBe("0.0000")
  })
})

describe("runningLedgerBalance", () => {
  it("carries an asset register forward in debit order", () => {
    expect(
      runningLedgerBalance("asset", [
        { debit: "500.00", credit: "0" },
        { debit: "0", credit: "200.00" },
      ]),
    ).toEqual(["500.0000", "300.0000"])
  })

  it("carries a liability register forward in credit order", () => {
    expect(
      runningLedgerBalance("liability", [
        { debit: "0", credit: "500.00" },
        { debit: "125.00", credit: "0" },
      ]),
    ).toEqual(["500.0000", "375.0000"])
  })
})
