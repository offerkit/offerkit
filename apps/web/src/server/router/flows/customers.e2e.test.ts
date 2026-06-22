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
      params: { id: created.id },
      body: { patch: { name: `${tag}-updated` } },
    });
    expect(updated.name).toBe(`${tag}-updated`);

    const search = await client.customers.list({ search: tag, limit: 5 });
    expect(search.data.find((c) => c.id === created.id)).toBeDefined();

    await client.customers.delete({ params: { id: created.id } });

    const after = await client.customers.list({ search: tag, limit: 5 });
    expect(after.data.find((c) => c.id === created.id)).toBeUndefined();

    await expect(client.customers.get({ params: { id: created.id } })).rejects.toThrow(
      /not found/i,
    );
  });

  it("upserts by externalId and fetches by externalId", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const externalId = randomId("ext-cust");
    const created = await client.customers.upsert({
      externalId,
      email: `${externalId}@example.com`,
      name: "Initial",
      phone: "+15555550123",
      address: { country: "US" },
      metadata: { tier: "silver" },
    });
    expect(created.created).toBe(true);
    expect(created.customer.externalId).toBe(externalId);

    const updated = await client.customers.upsert({
      externalId,
      name: "Updated",
      metadata: { tier: "gold" },
    });
    expect(updated.created).toBe(false);
    expect(updated.customer.id).toBe(created.customer.id);
    expect(updated.customer.name).toBe("Updated");

    const fetched = await client.customers.getByExternalId({
      params: { externalId },
    });
    expect(fetched.id).toBe(created.customer.id);
    expect(fetched.metadata).toEqual({ tier: "gold" });

    const patched = await client.customers.update({
      params: { id: fetched.id },
      body: {
        patch: {
          email: `${externalId}.updated@example.com`,
          phone: "+15555550999",
          address: { country: "CA" },
        },
      },
    });
    expect(patched.email).toBe(`${externalId}.updated@example.com`);

    await client.customers.delete({ params: { id: fetched.id } });
    await expect(
      client.customers.getByExternalId({ params: { externalId } }),
    ).rejects.toThrow(/not found/i);
  });
});
