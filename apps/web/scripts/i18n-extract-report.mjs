// Parses and validates the output of `gt generate --ignore-errors` (gt CLI
// 2.26.5, non-TTY). Kept separate from i18n-check.mjs so it can be unit
// tested. Every rule fails closed: output that does not match the known
// shape is an error, never a pass.

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");
const HEADER = /CLI tool encountered (\d+) syntax errors? while scanning for translatable content/;
const BULLET = /^│ {2}• (.+?) \((\d+):(\d+)\): (.*)$/;
const CONTINUATION = /^│ {2}(.*)$/;
const UNWRAPPED_MESSAGE = "has children that could change at runtime";

/**
 * @typedef {{ file: string, location: string, message: string, body: string[] }} Diagnostic
 * @typedef {{ file: string, body: string[] }} KnownDiagnostic
 */

/**
 * @param {string} output raw extractor output
 * @param {(absoluteOrRelativePath: string) => string} toRelative maps a reported path to a repo-stable key
 * @returns {{ completed: boolean, reportedCount: number | null, diagnostics: Diagnostic[], problems: string[] }}
 */
export function parseExtractReport(output, toRelative) {
  const lines = output.replace(ANSI, "").replace(/\r\n/g, "\n").split("\n");
  const problems = [];
  const diagnostics = [];
  let reportedCount = null;
  let inSection = false;
  /** @type {Diagnostic | null} */
  let current = null;

  for (const line of lines) {
    const header = HEADER.exec(line);
    if (header) {
      if (reportedCount !== null) problems.push(`repeated diagnostics header: ${line.trim()}`);
      reportedCount = Number(header[1]);
      inSection = true;
      continue;
    }
    if (!inSection) {
      if (line.includes("•")) problems.push(`diagnostic outside a diagnostics section: ${line.trim()}`);
      // Gutter text after the section closed would be a truncated diagnostic.
      else if (reportedCount !== null && CONTINUATION.test(line) && line.slice(3).trim() !== "") {
        problems.push(`unrecognized extractor output after diagnostics: ${line.trim()}`);
      }
      continue;
    }
    const bullet = BULLET.exec(line);
    if (bullet) {
      current = {
        file: toRelative(bullet[1] ?? ""),
        location: `${bullet[2]}:${bullet[3]}`,
        message: bullet[4] ?? "",
        body: [],
      };
      diagnostics.push(current);
      continue;
    }
    if (line.trimEnd() === "│" || line.trim() === "") {
      // A bare gutter line ends the diagnostics section.
      inSection = false;
      current = null;
      continue;
    }
    const continuation = CONTINUATION.exec(line);
    if (continuation && current) {
      current.body.push(continuation[1] ?? "");
      continue;
    }
    problems.push(`unrecognized extractor output: ${line.trim()}`);
  }

  const completed =
    lines.some((line) => line.includes("Source file saved successfully")) &&
    lines.some((line) => line.includes("Done!"));
  if (!completed) problems.push("extractor output has no completion marker");
  if (reportedCount !== null && reportedCount !== diagnostics.length) {
    problems.push(
      `extractor reported ${reportedCount} syntax errors but ${diagnostics.length} were parsed`,
    );
  }
  if (reportedCount === null && diagnostics.length > 0) {
    problems.push("diagnostics found without the extractor's error-count header");
  }
  return { completed, reportedCount, diagnostics, problems };
}

/** Stable key for a diagnostic: file plus its full expression block. */
export function diagnosticKey(entry) {
  return `${entry.file} :: ${entry.body.join("\n")}`;
}

/**
 * Validates parsed diagnostics against the allowlist. Every diagnostic must
 * be an unwrapped-children warning whose file and *entire* expression block
 * equal an allowlisted entry, and every allowlisted entry must still occur.
 *
 * @param {ReturnType<typeof parseExtractReport>} report
 * @param {KnownDiagnostic[]} known
 * @returns {string[]} errors (empty when the report is acceptable)
 */
export function validateExtractReport(report, known) {
  const errors = [...report.problems];
  const remaining = new Map();
  for (const entry of known) {
    const key = diagnosticKey(entry);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }
  for (const diagnostic of report.diagnostics) {
    const key = diagnosticKey(diagnostic);
    const left = remaining.get(key) ?? 0;
    if (!diagnostic.message.includes(UNWRAPPED_MESSAGE) || left === 0) {
      errors.push(
        `not allowlisted: ${diagnostic.file} (${diagnostic.location}): ${diagnostic.message}\n    ${diagnostic.body.join("\n    ")}`,
      );
      continue;
    }
    remaining.set(key, left - 1);
  }
  for (const [key, left] of remaining) {
    if (left > 0) errors.push(`obsolete allowlist entry (no longer reported): ${key}`);
  }
  return errors;
}
