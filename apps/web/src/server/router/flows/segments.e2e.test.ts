import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@offerkit/db";
import {
  E2E_ENABLED,
  TEST_DB_URL,
  deleteTestKey,
  getTestDb,
  makeClient,
  mintTestKey,
  randomId,
} from "./_helpers";

let db: Db | undefined;
let token: string | undefined;
let prefix: string | undefined;

beforeAll(async () => {
  if (!E2E_ENABLED || !TEST_DB_URL) return;
  ({ db } = await getTestDb(TEST_DB_URL));
  const minted = await mintTestKey(db);
  token = minted.token;
  prefix = minted.prefix;
}, 30_000);

afterAll(async () => {
  if (db && prefix) await deleteTestKey(db, prefix);
});

describe.skipIf(!E2E_ENABLED)("segments preview + CRUD", () => {
  it("create rule → preview returns matched count + sample → update reflects new logic", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    // Seed a customer that will match a specific email rule.
    const tag = randomId("seg");
    const email = `${tag}@example.com`;
    const seeded = await client.customers.create({ email, name: tag });

    // Rule that matches that exact email via JSON Logic equality.
    const matchRule = { "==": [{ var: "customer.email" }, email] };
    const segment = await client.segments.create({
      name: `seg-${tag}`,
      rule: matchRule,
    });
    expect(segment.id).toMatch(/^[0-9a-f-]{36}$/);

    const preview = await client.segments.preview({
      rule: matchRule,
      sampleSize: 10,
    });
    expect(preview.matchedCount).toBeGreaterThanOrEqual(1);
    expect(preview.sample.find((c) => c.id === seeded.id)).toBeDefined();

    // Update segment to a rule that matches nothing; preview reflects.
    const noMatchRule = {
      "==": [{ var: "customer.email" }, `__none__-${tag}@example.com`],
    };
    const updated = await client.segments.update({
      params: { id: segment.id },
      body: { patch: { rule: noMatchRule } },
    });
    expect(updated.rule).toEqual(noMatchRule);

    const previewAfter = await client.segments.preview({
      rule: noMatchRule,
      sampleSize: 10,
    });
    expect(previewAfter.matchedCount).toBe(0);
    expect(previewAfter.sample).toHaveLength(0);

    // Cleanup.
    await client.segments.delete({ params: { id: segment.id } });
    await client.customers.delete({ params: { id: seeded.id } });
  });
});
