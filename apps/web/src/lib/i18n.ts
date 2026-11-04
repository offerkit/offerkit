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
