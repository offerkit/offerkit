// Loads the committed translation files in src/i18n. gt-next picks this file
// up automatically (src/loadTranslations.ts), so translations are bundled with
// the app and never fetched from the General Translation CDN.
const loaders: Record<string, () => Promise<{ default: Record<string, unknown> }>> = {
  it: () => import("./i18n/it.json"),
  nl: () => import("./i18n/nl.json"),
};

export default async function loadTranslations(locale: string) {
  const load = loaders[locale];
  if (!load) return undefined;
  return (await load()).default;
}
