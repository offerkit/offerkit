import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE_NAME, resolveRequestLocale } from "./lib/i18n";

/**
 * gt-next request locale override (picked up by file convention from
 * src/getLocale.ts). gt-next's default lookup reads Accept-Language in header
 * order and ignores q-values, so `nl;q=0.1, it;q=0.9` would render Dutch.
 * This keeps the same precedence (cookie → Accept-Language → en) but ranks
 * Accept-Language by q-value, matching the account-email locale resolution.
 */
export default async function getLocale(): Promise<string> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveRequestLocale({
    cookie: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    acceptLanguage: headerList.get("accept-language"),
  });
}
