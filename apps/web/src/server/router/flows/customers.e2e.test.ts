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

describe.skipIf(!E2E_ENABLED)("customers CRUD", () => {
  it("create → update → list (search) → soft-delete excludes from list", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const tag = randomId("cust");
    const email = `${tag}@example.com`;
    const created = await client.customers.create({ email, name: tag });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.email).toBe(email);

    const updated = await client.customers.update({
      id: created.id,
      patch: { name: `${tag}-updated` },
    });
    expect(updated.name).toBe(`${tag}-updated`);

    const search = await client.customers.list({ search: tag, limit: 5 });
    expect(search.data.find((c) => c.id === created.id)).toBeDefined();

    await client.customers.delete({ id: created.id });

    const after = await client.customers.list({ search: tag, limit: 5 });
    expect(after.data.find((c) => c.id === created.id)).toBeUndefined();

    await expect(client.customers.get({ id: created.id })).rejects.toThrow(
      /not found/i,
    );
  });
});
