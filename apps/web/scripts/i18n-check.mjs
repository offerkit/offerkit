// Fails when src/i18n is out of date with the source, or when the gt
// extractor reports an untranslatable expression that is not listed below.
//
// `i18n:extract` passes --ignore-errors because a few <T> blocks still wrap
// raw date/money formatting that is owned by the locale-formatting work
// (#146). Without this check, --ignore-errors would also hide any *new*
// expression the extractor cannot translate, so those would silently stay
// English while the JSON files still looked up to date.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Known extractor errors as "<file relative to apps/web> :: <expression>".
 * Remove entries as the sites are wrapped in <Var>/<DateTime>/<Currency>.
 */
const KNOWN_EXTRACTION_ERRORS = new Set([
  "src/app/(dashboard)/campaigns/[id]/page.tsx :: {new Date(data.updatedAt).toLocaleString()}",
  "src/app/(dashboard)/customers/[id]/page.tsx :: {new Date(data.createdAt).toLocaleString()}",
  "src/app/(dashboard)/loyalty/[id]/page.tsx :: {new Date(program.updatedAt).toLocaleString()}",
  "src/app/(dashboard)/referrals/[id]/page.tsx :: {new Date(program.updatedAt).toLocaleString()}",
  "src/app/(dashboard)/rewards/[id]/page.tsx :: {new Date(data.updatedAt).toLocaleString()}",
  "src/app/(dashboard)/rules/[id]/page.tsx :: {new Date(data.updatedAt).toLocaleString()}",
  "src/app/(dashboard)/segments/[id]/page.tsx :: {new Date(data.updatedAt).toLocaleString()}",
  "src/app/(dashboard)/vouchers/[code]/page.tsx :: {new Date(data.updatedAt).toLocaleString()}",
  "src/app/(dashboard)/vouchers/[code]/page.tsx :: {currency ? formatMinorCurrency(balance, currency) : (balance / 100).toFixed(2)}",
]);

/** The gift-card balance site as it reads once #146 lands; allowed, never reported as stale. */
const UPCOMING_EXTRACTION_ERRORS = new Set([
  "src/app/(dashboard)/vouchers/[code]/page.tsx :: {currency ? <Money value={balance} currency={currency} /> : (balance / 100).toFixed(2)}",
]);

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: webRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  return { status: result.status ?? 1, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

const extract = run("pnpm", ["run", "--silent", "i18n:extract"]);
if (extract.status !== 0) {
  process.stdout.write(extract.output);
  console.error("i18n:check: extraction failed");
  process.exit(1);
}

const lines = extract.output.replace(/\x1b\[[0-9;]*m/g, "").split("\n");
const found = [];
lines.forEach((line, index) => {
  const match = /^[│|]?\s*• (.+?) \(\d+:\d+\): /.exec(line);
  if (!match?.[1]) return;
  const file = path.relative(webRoot, match[1]).split(path.sep).join("/");
  const expression = (lines[index + 1] ?? "").replace(/^[│|]?\s*/, "").trim();
  found.push(`${file} :: ${expression}`);
});

const unknown = found.filter(
  (entry) => !KNOWN_EXTRACTION_ERRORS.has(entry) && !UPCOMING_EXTRACTION_ERRORS.has(entry),
);
if (unknown.length > 0) {
  console.error("i18n:check: the gt extractor cannot translate these expressions:");
  for (const entry of unknown) console.error(`  ${entry}`);
  console.error("Wrap dynamic values in <Var>, <Num>, <DateTime> or <Currency> inside <T>.");
  process.exit(1);
}
const resolved = [...KNOWN_EXTRACTION_ERRORS].filter((entry) => !found.includes(entry));
if (resolved.length > 0) {
  console.warn("i18n:check: these known entries no longer occur and can be removed:");
  for (const entry of resolved) console.warn(`  ${entry}`);
}

const status = run("git", ["status", "--porcelain", "--", "src/i18n"]);
if (status.status !== 0 || status.output.trim().length > 0) {
  process.stdout.write(run("git", ["diff", "--stat", "--", "src/i18n"]).output);
  process.stdout.write(status.output);
  console.error("i18n:check: src/i18n is out of date. Run `pnpm i18n:extract` and translate new entries.");
  process.exit(1);
}
console.info(`i18n:check: src/i18n is up to date (${found.length} known extractor warnings).`);
