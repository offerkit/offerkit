import { describe, expect, it } from "vitest";
import { parseExtractReport, validateExtractReport } from "./i18n-extract-report.mjs";

const ROOT = "/repo/apps/web/";
const toRelative = (p) => (p.startsWith(ROOT) ? p.slice(ROOT.length) : p);
const MSG =
  "<T> component has children that could change at runtime. Use a variable component like <Var> to ensure this content is translated.";

/** Mirrors gt@2.26.5 non-TTY output: one bullet line, then every unwrapped expression on its own gutter line. */
function output(blocks, { count = blocks.length, done = true, header = true } = {}) {
  const lines = ["┌  Generating source templates...", "│"];
  if (header) {
    lines.push(
      `▲  Warning: CLI tool encountered ${count} syntax errors while scanning for translatable content. These components will not be translated.`,
    );
  }
  for (const block of blocks) {
    lines.push(`│  • ${ROOT}${block.file} (${block.at ?? "10:4"}): ${block.message ?? MSG}`);
    for (const expression of block.body) lines.push(`│  ${expression}`);
  }
  lines.push("│", "│");
  if (done) lines.push("◇  Source file saved successfully!", "│", "◇  Merged translations successfully!", "│", "└  Done!");
  return lines.join("\n");
}

const DATE = "{new Date(data.updatedAt).toLocaleString()}";
const KNOWN = [
  { file: "src/a/page.tsx", body: [DATE] },
  { file: "src/b/page.tsx", body: [DATE] },
];
const check = (text, known = KNOWN) => validateExtractReport(parseExtractReport(text, toRelative), known);

describe("i18n extractor report", () => {
  it("accepts output whose diagnostics exactly match the allowlist", () => {
    expect(check(output(KNOWN))).toEqual([]);
  });

  it("accepts a clean run with no diagnostics and no allowlist", () => {
    expect(check(output([], { header: false }), [])).toEqual([]);
  });

  it("strips ANSI colour codes", () => {
    const coloured = output(KNOWN).replace(DATE, `\u001b[36m${DATE}\u001b[39m`);
    expect(check(coloured)).toEqual([]);
  });

  it("fails when an allowlisted block gains a second unwrapped expression", () => {
    const errors = check(output([{ file: "src/a/page.tsx", body: [DATE, "{user.name}"] }, KNOWN[1]]));
    expect(errors.some((e) => e.startsWith("not allowlisted: src/a/page.tsx") && e.includes("{user.name}"))).toBe(true);
    expect(errors.some((e) => e.startsWith("obsolete allowlist entry"))).toBe(true);
  });

  it("fails on a diagnostic in a file that is not allowlisted", () => {
    const errors = check(output([...KNOWN, { file: "src/c/page.tsx", body: ["{String(Date.now())}"] }]));
    expect(errors).toEqual([expect.stringContaining("not allowlisted: src/c/page.tsx")]);
  });

  it("fails on an allowlisted expression with a different diagnostic message", () => {
    const errors = check(output([{ ...KNOWN[0], message: "Found nested <T> component." }, KNOWN[1]]));
    expect(errors.some((e) => e.includes("not allowlisted"))).toBe(true);
  });

  it("fails when an allowlist entry is no longer reported", () => {
    expect(check(output([KNOWN[0]]))).toEqual([
      expect.stringContaining("obsolete allowlist entry (no longer reported): src/b/page.tsx"),
    ]);
  });

  it("counts duplicate diagnostics separately", () => {
    const errors = check(output([...KNOWN, KNOWN[0]]));
    expect(errors).toEqual([expect.stringContaining("not allowlisted: src/a/page.tsx")]);
  });

  it("fails closed when the parsed count differs from the reported count", () => {
    expect(check(output(KNOWN, { count: 3 }))).toContainEqual(
      expect.stringContaining("reported 3 syntax errors but 2 were parsed"),
    );
  });

  it("fails closed without the error-count header", () => {
    expect(check(output(KNOWN, { header: false }))).toContainEqual(
      expect.stringContaining("diagnostic outside a diagnostics section"),
    );
  });

  it("fails closed without a completion marker", () => {
    expect(check(output(KNOWN, { done: false }))).toContainEqual(
      "extractor output has no completion marker",
    );
  });

  it("fails closed on gutter text after the diagnostics section", () => {
    const text = output(KNOWN).replace("│\n│\n◇", "│\n│  {orphaned()}\n│\n◇");
    expect(check(text)).toContainEqual(expect.stringContaining("after diagnostics: │  {orphaned()}"));
  });

  it("fails closed on unrecognized lines inside the section", () => {
    const text = output(KNOWN).replace(`│  ${DATE}\n│  •`, `│  ${DATE}\nsurprise\n│  •`);
    expect(check(text)).toContainEqual(expect.stringContaining("unrecognized extractor output: surprise"));
  });
});
