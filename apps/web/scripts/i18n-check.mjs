// Fails when src/i18n is out of date with the source, or when the gt
// extractor's diagnostics differ in any way from the allowlist below.
//
// `i18n:extract` passes --ignore-errors because a few <T> blocks still wrap
// raw date/money formatting owned by the locale-formatting work (#146).
// Without this check, --ignore-errors would also hide any *new* expression
// the extractor cannot translate, so it would silently stay English while
// the JSON files still looked up to date.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseExtractReport, validateExtractReport } from "./i18n-extract-report.mjs";

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Known extractor diagnostics: file (relative to apps/web) and the *entire*
 * expression block the extractor prints for that <T>. A block that gains or
 * changes an expression no longer matches, and an entry that is no longer
 * reported fails the check, so remove entries as sites are wrapped in
 * <Var>/<DateTime>/<Currency>. All of these are owned by #146 and must be
 * removed or updated when integrating it.
 */
const KNOWN_DIAGNOSTICS = [
  [
    "src/app/(dashboard)/vouchers/[code]/page.tsx",
    "{currency ? <Money value={balance} currency={currency} /> : (balance / 100).toFixed(2)}",
  ],
].map(([file, ...body]) => ({ file, body }));

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

const toRelative = (reported) =>
  path.relative(webRoot, path.resolve(webRoot, reported)).split(path.sep).join("/");
const report = parseExtractReport(extract.output, toRelative);
const errors = validateExtractReport(report, KNOWN_DIAGNOSTICS);
if (errors.length > 0) {
  console.error("i18n:check: gt extractor diagnostics do not match the allowlist:");
  for (const error of errors) console.error(`  ${error}`);
  console.error(
    "Wrap dynamic values in <Var>, <Num>, <DateTime> or <Currency> inside <T>, " +
      "and keep KNOWN_DIAGNOSTICS in scripts/i18n-check.mjs in sync.",
  );
  process.exit(1);
}

const status = run("git", ["status", "--porcelain", "--", "src/i18n"]);
if (status.status !== 0 || status.output.trim().length > 0) {
  process.stdout.write(run("git", ["diff", "--stat", "--", "src/i18n"]).output);
  process.stdout.write(status.output);
  console.error("i18n:check: src/i18n is out of date. Run `pnpm i18n:extract` and translate new entries.");
  process.exit(1);
}
console.info(
  `i18n:check: src/i18n is up to date (${report.diagnostics.length} allowlisted extractor diagnostics).`,
);
