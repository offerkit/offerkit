import { describe, expect, it } from "vitest";
import { currencyFractionDigits } from "./money";
import {
  formatDecimal,
  formatOptionalDecimal,
  needsReformat,
  parseDecimalToMinorUnit,
} from "./money-input";

const precision = (currency: string) => {
  const decimals = currencyFractionDigits(currency);
  return { scale: 10 ** decimals, decimals };
};

describe("money input precision", () => {
  it.each([
    ["USD", "12.34", 1234],
    ["JPY", "1234", 1234],
    ["KWD", "1.234", 1234],
  ])("round-trips %s minor units", (currency, text, minor) => {
    const { scale, decimals } = precision(currency);
    expect(parseDecimalToMinorUnit(text, scale)).toBe(minor);
    expect(formatDecimal(minor, scale, decimals)).toBe(text);
  });

  it("keeps an empty optional amount empty", () => {
    expect(formatOptionalDecimal("", 1000, 3)).toBe("");
  });
});

describe("needsReformat", () => {
  const usdFallback = { value: 1234, ...precision("USD") };

  it("reformats when the campaign currency loads with a different precision", () => {
    for (const currency of ["JPY", "KWD"]) {
      const next = { value: 1234, ...precision(currency) };
      expect(needsReformat(usdFallback, next)).toBe(true);
    }
    // The regenerated text then matches the stored minor units.
    expect(formatDecimal(1234, 1, 0)).toBe("1234");
    expect(formatDecimal(1234, 1000, 3)).toBe("1.234");
  });

  it("reformats when the value changes from outside the input", () => {
    expect(needsReformat(usdFallback, { ...usdFallback, value: 999 })).toBe(true);
  });

  it("leaves in-progress typing alone when nothing changed", () => {
    expect(needsReformat(usdFallback, { ...usdFallback })).toBe(false);
    const empty = { value: "" as const, scale: 100, decimals: 2 };
    expect(needsReformat(empty, { ...empty })).toBe(false);
  });
});
