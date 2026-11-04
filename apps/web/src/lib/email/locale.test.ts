import { describe, expect, it } from "vitest";
import {
  LOCALE_COOKIE_NAME,
  matchAcceptLanguage,
  resolveEmailLocale,
  toSupportedLocale,
} from "./locale.ts";

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

describe("resolveEmailLocale", () => {
  it("uses gt-next's locale cookie name", () => {
    expect(LOCALE_COOKIE_NAME).toBe("generaltranslation.locale");
  });

  it("prefers a supported locale cookie over Accept-Language", () => {
    expect(
      resolveEmailLocale(
        headers({
          cookie: `session=abc; ${LOCALE_COOKIE_NAME}=it; other=1`,
          "accept-language": "nl-NL,nl;q=0.9",
        }),
      ),
    ).toBe("it");
  });

  it("normalises a regional cookie value", () => {
    expect(resolveEmailLocale(headers({ cookie: `${LOCALE_COOKIE_NAME}=nl-BE` }))).toBe("nl");
  });

  it("ignores an unsupported cookie and falls back to Accept-Language", () => {
    expect(
      resolveEmailLocale(
        headers({ cookie: `${LOCALE_COOKIE_NAME}=fr`, "accept-language": "it-IT" }),
      ),
    ).toBe("it");
  });

  it("does not match cookies whose names merely contain the locale cookie name", () => {
    expect(
      resolveEmailLocale(headers({ cookie: `x${LOCALE_COOKIE_NAME}=nl` })),
    ).toBe("en");
  });

  it("maps regional Accept-Language variants to their base locale", () => {
    expect(resolveEmailLocale(headers({ "accept-language": "nl-BE" }))).toBe("nl");
  });

  it("honours q-values regardless of order", () => {
    expect(
      resolveEmailLocale(headers({ "accept-language": "en;q=0.5, it-CH;q=0.8, de;q=1" })),
    ).toBe("it");
  });

  it("skips entries with q=0", () => {
    expect(matchAcceptLanguage("nl;q=0, it;q=0.1")).toBe("it");
  });

  it("falls back to en for unsupported languages", () => {
    expect(resolveEmailLocale(headers({ "accept-language": "fr-FR,de;q=0.8" }))).toBe("en");
  });

  it("falls back to en without headers", () => {
    expect(resolveEmailLocale(undefined)).toBe("en");
    expect(resolveEmailLocale(headers({}))).toBe("en");
    expect(resolveEmailLocale(headers({ "accept-language": "*" }))).toBe("en");
  });
});

describe("toSupportedLocale", () => {
  it("is case-insensitive and accepts underscores", () => {
    expect(toSupportedLocale("IT")).toBe("it");
    expect(toSupportedLocale("nl_NL")).toBe("nl");
    expect(toSupportedLocale("pt-BR")).toBeNull();
    expect(toSupportedLocale("")).toBeNull();
  });
});
