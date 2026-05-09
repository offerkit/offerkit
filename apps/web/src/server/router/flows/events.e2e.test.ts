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

describe.skipIf(!E2E_ENABLED)("events log", () => {
  it("a customer.created event is logged when customers.create runs", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const created = await client.customers.create({
      email: `${randomId("evt")}@example.com`,
    });

    // events.list returns the most recent events. Filter by type and
    // confirm the entity-id matches the row we just created.
    const list = await client.events.list({
      type: "customer.created",
      limit: 50,
    });
    expect(list.data.length).toBeGreaterThan(0);
    const ours = list.data.find((e) => e.entityId === created.id);
    expect(ours).toBeDefined();
    expect(ours?.type).toBe("customer.created");
  });
});
