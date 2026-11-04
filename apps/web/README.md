# OfferKit web

The Next.js dashboard and API server for OfferKit.

## Development

From the repository root, install dependencies and configure the local environment:

```bash
pnpm install
cp .env.example .env
docker compose up -d postgres redis
pnpm --filter @offerkit/db push
pnpm --filter @offerkit/web dev
```

The app runs at `http://localhost:3000`. The separate public site workspace runs with `pnpm --filter @offerkit/site dev`; its documentation is published at <https://offerkit.dev/docs>.

## Checks

```bash
pnpm --filter @offerkit/web lint
pnpm --filter @offerkit/web typecheck
pnpm --filter @offerkit/web test
pnpm --filter @offerkit/web build
```

## Languages

The dashboard ships in English (default), Italian (`it`) and Dutch (`nl`). Translations are committed JSON files in `src/i18n/` and are bundled with the app by `src/loadTranslations.ts`, so a self-hosted deployment needs no General Translation account, project ID, API key or network access to show them. `next.config.mjs` keeps GT's runtime and CDN translation disabled on purpose.

### How the language is chosen

1. A saved choice: the `generaltranslation.locale` cookie, set for one year by **Language** in the user menu.
2. Otherwise the browser's `Accept-Language` header.
3. Otherwise English.

URLs carry no locale prefix, and `<html lang>` follows the active locale. Locale resolution is gt-next's built-in cookie/header lookup; no proxy (middleware) is involved.

### Adding or changing strings

Wrap user-visible copy so the extractor can find it:

- JSX: `<T>Save changes</T>`. Put dynamic values in `<Var>` (or `<Num>`, `<DateTime>`, `<Currency>`): `<T>Lifetime: <Var>{points}</Var></T>`.
- Strings in components: `const gt = useGT(); gt("Customer created")`, with variables as `gt("Code issued: {code}", { code })`.
- Strings defined outside components (config arrays, zod messages): `msg("Customers")`, rendered with `useMessages()` / `getMessages()`.
- API errors: `useApiErrorMessage()` from `src/lib/api-error-message.ts` maps known error codes and server messages to translated text and falls back to the server message. Add new codes there.

Then refresh the files and translate the new entries:

```bash
pnpm --filter @offerkit/web i18n:extract
```

`i18n:extract` runs the `gt` CLI's local `generate` command (pinned with `pnpm dlx`, no login). It rewrites `src/i18n/en.json` from the source, adds new keys to `it.json` and `nl.json` with the English text as a placeholder, and drops keys whose source string is gone. Keys are content hashes, so edit the `it`/`nl` value that has the same key as the English entry. Keep OfferKit, product names, codes and API terms such as `LOYALTY_PROGRAM` untranslated, and keep `{variables}` and `_gt_value_N` placeholders intact.

`pnpm --filter @offerkit/web test` fails when an `it`/`nl` entry is missing, stale, still identical to English (outside a short allowlist in `src/i18n/translations.test.ts`) or drops a variable. CI also runs `i18n:check`, which fails when `src/i18n/` is out of date with the source.

### Adding a language

1. Add the locale code to `locales` in `gt.config.json`.
2. Add it to `DASHBOARD_LOCALES` in `src/lib/i18n.ts` with its native name, and to the loader map in `src/loadTranslations.ts`.
3. Run `i18n:extract`, translate the new `src/i18n/<locale>.json`, and add an allowlist entry for it in `src/i18n/translations.test.ts`.

The CLI, MCP server and public documentation stay in English and are not covered by these files; transactional emails are localized separately.
