import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import loadTranslations from "../loadTranslations";
import { DASHBOARD_LOCALES } from "../lib/i18n";
import en from "./en.json";
import itTranslations from "./it.json";
import nlTranslations from "./nl.json";

type Entry = string | ReadonlyArray<string | { k: string }>;
type Translations = Record<string, Entry>;

const source = en as Translations;
const targets: Record<string, Translations> = {
  it: itTranslations as Translations,
  nl: nlTranslations as Translations,
};

/**
 * Source strings that are legitimately spelled the same in the target
 * language (loanwords, product terms, sample data). Anything else that still
 * equals the English source is treated as an untranslated string.
 */
const SAME_AS_ENGLISH: Record<string, readonly string[]> = {
  it: [
    "Account",
    "Alice",
    "Email",
    "Formula",
    "Gift card",
    "Input",
    "no",
    "Password",
    "Payload",
    "URL",
    "Voucher",
    "Workspace",
  ],
  nl: [
    "Account",
    "Actor",
    "Alice",
    "Code",
    "Details",
    "Endpoints",
    "Loyalty",
    "Payload",
    "Percentage",
    "Prefix",
    "Scopes",
    "Status",
    "Type",
    "URL",
    "Voucher",
    "Vouchers",
    "Webhooks",
    "Workspace",
  ],
};

/** Strings from the sign-in page, navigation, user menu and OAuth consent page. */
const KEY_PAGE_STRINGS = [
  "Sign in",
  "Welcome to Offerkit",
  "Signing in…",
  "Customers",
  "Campaigns",
  "Settings",
  "Language",
  "Sign out",
  "Connect an AI assistant to OfferKit?",
  "This connection will be able to:",
  "Allow access",
  "Deny",
  "Cancel",
  "Confirm",
  "This field is required",
  "Referrer cannot also be the referee",
];

function placeholders(entry: Entry): string[] {
  if (typeof entry === "string") return [...entry.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
  return entry.flatMap((part) => (typeof part === "string" ? [] : [part.k])).sort();
}

describe("dashboard translations", () => {
  it("lists the same locales in gt.config.json and the language switcher", () => {
    const config = JSON.parse(
      readFileSync(path.resolve(__dirname, "../../gt.config.json"), "utf8"),
    ) as { defaultLocale: string; locales: string[] };
    expect(config.defaultLocale).toBe("en");
    expect(config.locales).toEqual(DASHBOARD_LOCALES.map((locale) => locale.code));
  });

  it("extracted source strings", () => {
    expect(Object.keys(source).length).toBeGreaterThan(0);
  });

  for (const [locale, translations] of Object.entries(targets)) {
    describe(locale, () => {
      it("has an entry for every source string and no stale entries", () => {
        expect(Object.keys(translations).sort()).toEqual(Object.keys(source).sort());
      });

      it("translates every source string", () => {
        const allowed = new Set(SAME_AS_ENGLISH[locale]);
        const untranslated = Object.entries(source)
          .filter(([hash, text]) => JSON.stringify(translations[hash]) === JSON.stringify(text))
          .map(([, text]) => text)
          .filter((text) => typeof text !== "string" || !allowed.has(text));
        expect(untranslated).toEqual([]);
      });

      it("keeps every variable from the source string", () => {
        const mismatched = Object.entries(source)
          .filter(([hash, text]) => {
            const translated = translations[hash];
            return (
              translated === undefined ||
              typeof translated !== typeof text ||
              JSON.stringify(placeholders(translated)) !== JSON.stringify(placeholders(text))
            );
          })
          .map(([, text]) => text);
        expect(mismatched).toEqual([]);
      });

      it("translates the key page strings", () => {
        for (const text of KEY_PAGE_STRINGS) {
          const hashes = Object.keys(source).filter((hash) => source[hash] === text);
          expect(hashes, `"${text}" is missing from en.json`).not.toHaveLength(0);
          for (const hash of hashes) expect(translations[hash]).not.toBe(text);
        }
      });

      it("loads from the committed file", async () => {
        await expect(loadTranslations(locale)).resolves.toEqual(translations);
      });
    });
  }

  it("does not load a translation file for the default locale", async () => {
    await expect(loadTranslations("en")).resolves.toBeUndefined();
  });
});
