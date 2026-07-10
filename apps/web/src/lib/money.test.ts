import { describe, expect, it } from "vitest";
import { formatMinorCurrency } from "./money";

describe("formatMinorCurrency", () => {
  it("converts minor units before applying currency formatting", () => {
    const expected = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format(12.34);

    expect(formatMinorCurrency(1_234, "USD")).toBe(expected);
  });

  it("falls back to a stable amount and currency string", () => {
    expect(formatMinorCurrency(1_234, "not-a-currency")).toBe("12.34 not-a-currency");
  });
});
