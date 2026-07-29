import { describe, expect, it } from "vitest";
import { formatDecimal, formatDecimalInput } from "../lib/utils";

describe("decimal display formatting", () => {
  it("keeps two decimal places for accounting values", () => {
    expect(formatDecimal("18.5000")).toBe("18.50");
  });

  it("preserves meaningful precision up to four decimal places", () => {
    expect(formatDecimal("18.5031")).toBe("18.5031");
    expect(formatDecimal("18.5030")).toBe("18.503");
  });

  it("normalizes values shown inside editable rate inputs", () => {
    expect(formatDecimalInput("18.5000")).toBe("18.50");
    expect(formatDecimalInput("18.5031")).toBe("18.5031");
    expect(formatDecimalInput("18")).toBe("18.00");
  });
});
