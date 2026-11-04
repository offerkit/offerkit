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

/** Best supported match from an Accept-Language header, honouring q-values. */
export function matchAcceptLanguage(header: string | null | undefined): EmailLocale | null {
  if (!header) return null;
  const ranked = header
    .split(",")
    .map((entry, index) => {
      const [tag = "", ...params] = entry.trim().split(";");
      let q = 1;
      for (const param of params) {
        const [key, value] = param.trim().split("=");
        if (key?.trim() === "q") {
          const parsed = Number(value);
          q = Number.isFinite(parsed) ? parsed : 0;
        }
      }
      return { tag: tag.trim(), q, index };
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
