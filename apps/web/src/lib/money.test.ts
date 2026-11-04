import { describe, expect, it } from "vitest";
import { currencyFractionDigits, formatMinorCurrency, minorToMajor } from "./money";

// Intl output may contain narrow/no-break spaces; normalize for readable assertions.
const normalize = (value: string) => value.replace(/[  ]/g, " ");

describe("currencyFractionDigits", () => {
  it("uses the ISO 4217 exponent for the currency", () => {
    expect(currencyFractionDigits("USD")).toBe(2);
    expect(currencyFractionDigits("EUR")).toBe(2);
    expect(currencyFractionDigits("JPY")).toBe(0);
    expect(currencyFractionDigits("KWD")).toBe(3);
  });

  it("defaults to two digits for invalid codes", () => {
    expect(currencyFractionDigits("not-a-currency")).toBe(2);
  });
});

describe("minorToMajor", () => {
  it("converts minor units using the currency exponent", () => {
    expect(minorToMajor(1_234, "USD")).toBe(12.34);
    expect(minorToMajor(500, "JPY")).toBe(500);
    expect(minorToMajor(1_234, "KWD")).toBe(1.234);
  });
});

describe("formatMinorCurrency", () => {
  it("formats USD minor units", () => {
    expect(formatMinorCurrency(1_234, "USD", "en-US")).toBe("$12.34");
  });

  it("formats EUR in the requested locale", () => {
    expect(normalize(formatMinorCurrency(12_345_678, "EUR", "de"))).toBe("123.456,78 €");
    expect(normalize(formatMinorCurrency(12_345_678, "EUR", "it"))).toBe("123.456,78 €");
    expect(normalize(formatMinorCurrency(12_345_678, "EUR", "nl"))).toBe("€ 123.456,78");
  });

  it("does not divide zero-decimal currencies", () => {
    expect(formatMinorCurrency(500, "JPY", "en-US")).toBe("¥500");
  });

  it("uses three decimals for KWD", () => {
    expect(normalize(formatMinorCurrency(1_234, "KWD", "en-US"))).toBe("KWD 1.234");
  });

  it("uses the runtime locale when none is provided", () => {
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
