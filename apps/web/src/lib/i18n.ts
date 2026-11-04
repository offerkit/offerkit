/**
 * Dashboard languages. Keep in sync with `locales` in gt.config.json (a unit
 * test enforces it). Labels are endonyms so every option is readable to the
 * speaker who needs it, whatever the current UI language.
 */
export const DASHBOARD_LOCALES = [
  { code: "en", label: "English" },
  { code: "it", label: "Italiano" },
  { code: "nl", label: "Nederlands" },
] as const;

export type DashboardLocale = (typeof DASHBOARD_LOCALES)[number]["code"];

/**
 * gt-next reads this cookie on every request (before Accept-Language), so a
 * saved choice wins over the browser preference. Same name as gt-next's
 * default `localeCookieName`.
 */
export const LOCALE_COOKIE_NAME = "generaltranslation.locale";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function localeCookie(locale: DashboardLocale): string {
  return `${LOCALE_COOKIE_NAME}=${locale}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
}

export function isDashboardLocale(value: string): value is DashboardLocale {
  return DASHBOARD_LOCALES.some((locale) => locale.code === value);
}

/** Maps a BCP 47 tag (`nl-BE`, `IT`, `it_CH`) to a dashboard locale, or null. */
export function toDashboardLocale(tag: string | null | undefined): DashboardLocale | null {
  if (!tag) return null;
  const base = tag.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return isDashboardLocale(base) ? base : null;
}

/** RFC 9110 qvalue: 0–1 with at most three decimals. */
const QVALUE = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

/**
 * Best dashboard locale for an Accept-Language header. Honours q-values
 * (case-insensitive `q`, `q=0` excludes a language, header order breaks ties);
 * an invalid q-value drops its entry.
 */
export function matchAcceptLanguage(header: string | null | undefined): DashboardLocale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((entry, index) => {
      const [tag = "", ...params] = entry.trim().split(";");
      let q = 1;
      for (const param of params) {
        const [key = "", value = ""] = param.trim().split("=");
        if (key.trim().toLowerCase() === "q") {
          const raw = value.trim();
          q = QVALUE.test(raw) ? Number(raw) : 0;
        }
      }
      return { tag: tag.trim(), q, index };
    })
    .filter((entry) => entry.tag.length > 0 && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const entry of ranked) {
    const locale = toDashboardLocale(entry.tag);
    if (locale) return locale;
  }
  return null;
}

/** Saved cookie choice, then Accept-Language, then English. */
export function resolveRequestLocale(input: {
  cookie?: string | null;
  acceptLanguage?: string | null;
}): DashboardLocale {
  return toDashboardLocale(input.cookie) ?? matchAcceptLanguage(input.acceptLanguage) ?? "en";
}
