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

describe.skipIf(!E2E_ENABLED)("vouchers bulk + CRUD + transactions", () => {
  it("inline bulk mint generates 5 codes", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-bulk-inline"),
      type: "DISCOUNT",
      currency: "USD",
    });

    const result = await client.vouchers.bulk({
      campaignId: campaign.id,
      count: 5,
    });
    expect(result.generated).toBe(5);
    expect(result.jobId).toBeUndefined();

    const list = await client.vouchers.list({ campaignId: campaign.id, limit: 10 });
    expect(list.data).toHaveLength(5);
  }, 30_000);

  it("large bulk above threshold returns jobId and 0 generated", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-bulk-async"),
      type: "DISCOUNT",
      currency: "USD",
    });

    const result = await client.vouchers.bulk({
      campaignId: campaign.id,
      count: 10_001,
    });
    expect(result.generated).toBe(0);
    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("per-voucher CRUD: get → update active=false → soft-delete", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-crud"),
      type: "DISCOUNT",
      currency: "USD",
    });

    const code = randomId("V-CRUD").toUpperCase();
    const created = await client.vouchers.create({
      code,
      campaignId: campaign.id,
      type: "DISCOUNT",
      discount: { type: "AMOUNT", amount: 500 },
    });
    expect(created.code).toBe(code);
    expect(created.active).toBe(true);

    const fetched = await client.vouchers.get({ code });
    expect(fetched.id).toBe(created.id);

    const updated = await client.vouchers.update({
      code,
      patch: { active: false },
    });
    expect(updated.active).toBe(false);

    await client.vouchers.delete({ code });

    await expect(client.vouchers.get({ code })).rejects.toThrow(/not found/i);
  });

  it("transactions endpoint returns the gift-card credit ledger", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-gc"),
      type: "GIFT_VOUCHERS",
      currency: "USD",
    });

    const code = randomId("GC-TX").toUpperCase();
    await client.vouchers.create({
      code,
      campaignId: campaign.id,
      type: "GIFT_CARD",
      giftBalance: 5_000,
    });

    const tx = await client.vouchers.transactions({ code });
    expect(Array.isArray(tx.data)).toBe(true);
    // Initial credit is recorded when the gift card is minted.
    const credit = tx.data.find((t) => t.reason === "CREDIT");
    expect(credit).toBeDefined();
    expect(credit?.delta).toBe(5_000);
    expect(credit?.balanceAfter).toBe(5_000);
  });
});
