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
 * Weight of one Accept-Language entry from its `;`-separated parameters.
 * Parameter names are case-insensitive; each parameter splits on its first
 * `=` only and the whole value must be an RFC 9110 qvalue. A malformed,
 * out-of-range or repeated q parameter drops the entry (weight 0), and a
 * later parameter can never rehabilitate it. No q parameter means weight 1.
 * Same rules as the account-email locale resolver.
 */
function parseWeight(params: string[]): number {
  let q: number | null = null;
  for (const param of params) {
    const eq = param.indexOf("=");
    const key = (eq === -1 ? param : param.slice(0, eq)).trim().toLowerCase();
    if (key !== "q") continue;
    if (q !== null) return 0;
    const raw = eq === -1 ? "" : param.slice(eq + 1).trim();
    if (!QVALUE.test(raw)) return 0;
    q = Number(raw);
  }
  return q ?? 1;
}

/**
 * Best dashboard locale for an Accept-Language header, ranked by q-value
 * (`q=0` excludes a language, header order breaks ties).
 */
export function matchAcceptLanguage(header: string | null | undefined): DashboardLocale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((entry, index) => {
      const [tag = "", ...params] = entry.trim().split(";");
      return { tag: tag.trim(), q: parseWeight(params), index };
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
