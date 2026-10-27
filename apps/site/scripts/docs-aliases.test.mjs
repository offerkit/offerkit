import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canonicalDocsUrl } from "../src/lib/docs-aliases.mjs";

test("navigation alias destinations match the deployed permanent redirects", async () => {
  const rules = (await readFile(new URL("../public/_redirects", import.meta.url), "utf8"))
    .trim().split("\n");
  for (const rule of rules) {
    const [source, destination, status] = rule.split(/\s+/);
    assert.equal(canonicalDocsUrl(source), destination);
    assert.equal(status, "301");
  }
});

test("documentation aliases preserve fragments and queries", () => {
  assert.equal(canonicalDocsUrl("/docs/api-reference?format=json#errors"), "/docs/reference/api-reference/?format=json#errors");
  assert.equal(canonicalDocsUrl("/docs/next/webhooks/#events"), "/docs/next/integrate/webhooks/#events");
});

test("historical v0.1 guides and current non-alias pages keep their URLs", () => {
  for (const url of ["/docs/v/0.1/api-reference/", "/docs/reference/api-reference/", "/docs/migrating-referrals/"]) {
    assert.equal(canonicalDocsUrl(url), url);
  }
});
