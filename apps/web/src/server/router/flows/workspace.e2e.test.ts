import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@offerkit/db";
import {
  E2E_ENABLED,
  TEST_DB_URL,
  deleteTestKey,
  getTestDb,
  makeClient,
  mintTestKey,
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

describe.skipIf(!E2E_ENABLED)("workspace settings", () => {
  it("get → update → get reflects the change", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const before = await client.workspace.get({});
    expect(before.defaultCurrency).toMatch(/^[A-Z]{3}$/);

    const newName = `Test workspace ${String(Date.now())}`;
    const updated = await client.workspace.update({ name: newName });
    expect(updated.name).toBe(newName);

    const after = await client.workspace.get({});
    expect(after.name).toBe(newName);

    // Restore prior name so other test runs don't drift.
    await client.workspace.update({ name: before.name });
  });
});
