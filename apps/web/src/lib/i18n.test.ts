import { describe, expect, it } from "vitest";
import { localeCookie, matchAcceptLanguage, resolveRequestLocale, toDashboardLocale } from "./i18n";

describe("toDashboardLocale", () => {
  it("maps regional variants and casing to the base language", () => {
    expect(toDashboardLocale("nl-BE")).toBe("nl");
    expect(toDashboardLocale("IT")).toBe("it");
    expect(toDashboardLocale("it_CH")).toBe("it");
    expect(toDashboardLocale("en-GB")).toBe("en");
  });

  it("rejects unsupported or empty tags", () => {
    expect(toDashboardLocale("fr-FR")).toBeNull();
    expect(toDashboardLocale("")).toBeNull();
    expect(toDashboardLocale(undefined)).toBeNull();
  });
});

describe("matchAcceptLanguage", () => {
  it("ranks by q-value rather than header order", () => {
    expect(matchAcceptLanguage("nl;q=0.1, it;q=0.9")).toBe("it");
    expect(matchAcceptLanguage("en;q=0.5, it-CH;q=0.8, de;q=1")).toBe("it");
  });

  it("excludes languages with q=0", () => {
    expect(matchAcceptLanguage("nl;q=0,it;q=1")).toBe("it");
    expect(matchAcceptLanguage("nl;q=0, it;q=0.1")).toBe("it");
    expect(matchAcceptLanguage("nl;q=0.000")).toBeNull();
  });

  it("treats the q parameter name case-insensitively", () => {
    expect(matchAcceptLanguage("nl;Q=0, it;q=0.8")).toBe("it");
    expect(matchAcceptLanguage("nl;Q=0.2, it;Q=0.8")).toBe("it");
  });

  it("breaks ties by header order", () => {
    expect(matchAcceptLanguage("nl, it")).toBe("nl");
    expect(matchAcceptLanguage("it;q=0.7, nl;q=0.7")).toBe("it");
  });

  it("ignores malformed and out-of-range q-values", () => {
    expect(matchAcceptLanguage("nl;q=2, it;q=1")).toBe("it");
    expect(matchAcceptLanguage("nl;q=0x1, it;q=0.5")).toBe("it");
    expect(matchAcceptLanguage("nl;q=1e0, it;q=0.5")).toBe("it");
    expect(matchAcceptLanguage("nl;q=0.1234, it;q=0.5")).toBe("it");
    expect(matchAcceptLanguage("nl;q=, it;q=0.5")).toBe("it");
    expect(matchAcceptLanguage("nl;q = 0.9 , it;q=0.5")).toBe("nl");
  });

  it("drops entries whose q-value has trailing garbage", () => {
    expect(matchAcceptLanguage("nl;q=0.9=garbage, it;q=0.8")).toBe("it");
  });

  it("does not let a later q parameter rehabilitate an invalid one", () => {
    expect(matchAcceptLanguage("nl;q=bogus;q=1, it;q=0.8")).toBe("it");
  });

  it("drops entries with repeated q parameters", () => {
    expect(matchAcceptLanguage("nl;q=0.9;q=0.9, it;q=0.8")).toBe("it");
    expect(matchAcceptLanguage("nl;q, it;q=0.8")).toBe("it");
  });

  it("ignores non-q parameters", () => {
    expect(matchAcceptLanguage("nl;level=1, it;q=0.8")).toBe("nl");
  });

  it("drops entries with invalid q-values", () => {
    expect(matchAcceptLanguage("nl;q=2, it;q=0.5")).toBe("it");
    expect(matchAcceptLanguage("nl;q=0.1234, it;q=0.5")).toBe("it");
    expect(matchAcceptLanguage("nl;q=abc, it;q=0.5")).toBe("it");
    expect(matchAcceptLanguage("nl;q=-1, it;q=0.5")).toBe("it");
    expect(matchAcceptLanguage("nl;q=, it;q=0.5")).toBe("it");
  });

  it("accepts RFC 9110 qvalue forms", () => {
    expect(matchAcceptLanguage("it;q=1.000, nl;q=0.999")).toBe("it");
    expect(matchAcceptLanguage("it;q=0., nl;q=1.")).toBe("nl");
  });

  it("skips unsupported languages and wildcards", () => {
    expect(matchAcceptLanguage("fr-FR, de;q=0.9, nl-BE;q=0.5")).toBe("nl");
    expect(matchAcceptLanguage("*")).toBeNull();
    expect(matchAcceptLanguage("fr")).toBeNull();
    expect(matchAcceptLanguage("")).toBeNull();
    expect(matchAcceptLanguage(null)).toBeNull();
  });
});

describe("resolveRequestLocale", () => {
  it("prefers a supported cookie over Accept-Language", () => {
    expect(resolveRequestLocale({ cookie: "nl", acceptLanguage: "it" })).toBe("nl");
    expect(resolveRequestLocale({ cookie: "en", acceptLanguage: "it" })).toBe("en");
  });

  it("ignores an unsupported cookie", () => {
    expect(resolveRequestLocale({ cookie: "fr", acceptLanguage: "it;q=0.5" })).toBe("it");
  });

  it("falls back to English", () => {
    expect(resolveRequestLocale({ acceptLanguage: "fr, de;q=0.5" })).toBe("en");
    expect(resolveRequestLocale({})).toBe("en");
  });
});

describe("localeCookie", () => {
  it("persists for a year on every path", () => {
    expect(localeCookie("it")).toBe(
      "generaltranslation.locale=it; path=/; max-age=31536000; samesite=lax",
    );
  });
});
