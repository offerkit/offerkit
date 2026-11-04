export const EMAIL_LOCALES = ["en", "it", "nl"] as const;
export type EmailLocale = (typeof EMAIL_LOCALES)[number];
export const DEFAULT_EMAIL_LOCALE: EmailLocale = "en";

/**
 * Cookie gt-next uses to persist the dashboard locale. Matches
 * `defaultLocaleCookieName` exported by gt-react (re-used by gt-next's
 * `I18NConfiguration`); the app does not override it.
 */
export const LOCALE_COOKIE_NAME = "generaltranslation.locale";

/** Maps a BCP 47 tag (e.g. `nl-BE`, `IT`) to a supported locale, or null. */
export function toSupportedLocale(tag: string | null | undefined): EmailLocale | null {
  if (!tag) return null;
  const base = tag.trim().toLowerCase().split(/[-_]/)[0];
  return (EMAIL_LOCALES as readonly string[]).includes(base ?? "")
    ? (base as EmailLocale)
    : null;
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** RFC 9110 qvalue: 0–1 with at most three decimals. */
const QVALUE = /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/;

/**
 * Weight of one Accept-Language entry from its `;`-separated parameters.
 * Parameter names are case-insensitive. A malformed, out-of-range or
 * repeated q-value drops the entry (returns 0) rather than outranking valid
 * ones; a later parameter can never rehabilitate an invalid one.
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

/** Best supported match from an Accept-Language header, honouring q-values. */
export function matchAcceptLanguage(header: string | null | undefined): EmailLocale | null {
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
    const locale = toSupportedLocale(entry.tag);
    if (locale) return locale;
  }
  return null;
}

/**
 * Resolves the email locale for a request: the gt-next locale cookie when it
 * holds a supported locale, else the best Accept-Language match, else `en`.
 */
export function resolveEmailLocale(headers: Headers | null | undefined): EmailLocale {
  if (!headers) return DEFAULT_EMAIL_LOCALE;
  return (
    toSupportedLocale(readCookie(headers.get("cookie"), LOCALE_COOKIE_NAME)) ??
    matchAcceptLanguage(headers.get("accept-language")) ??
    DEFAULT_EMAIL_LOCALE
  );
}
