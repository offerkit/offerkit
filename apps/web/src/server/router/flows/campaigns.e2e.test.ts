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

describe.skipIf(!E2E_ENABLED)("campaigns CRUD", () => {
  it("create → update → list (search) → soft-delete excludes from list", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const name = randomId("camp");
    const created = await client.campaigns.create({
      name,
      type: "DISCOUNT",
      currency: "USD",
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.name).toBe(name);

    const updated = await client.campaigns.update({
      params: { id: created.id },
      body: { patch: { description: "tagged for e2e" } },
    });
    expect(updated.description).toBe("tagged for e2e");

    const search = await client.campaigns.list({ search: name, limit: 5 });
    expect(search.data.find((c) => c.id === created.id)).toBeDefined();

    await client.campaigns.delete({ params: { id: created.id } });

    const after = await client.campaigns.list({ search: name, limit: 5 });
    expect(after.data.find((c) => c.id === created.id)).toBeUndefined();

    // get on a soft-deleted row returns NOT_FOUND.
    await expect(client.campaigns.get({ params: { id: created.id } })).rejects.toThrow(
      /not found/i,
    );
  });
});
