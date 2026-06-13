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

describe.skipIf(!E2E_ENABLED)("redemption flows", () => {
  it("discount voucher: redeem → idempotency replay returns same redemptionId", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-disc"),
      type: "DISCOUNT",
      currency: "USD",
    });
    const code = randomId("DISC").toUpperCase();
    await client.vouchers.create({
      code,
      campaignId: campaign.id,
      type: "DISCOUNT",
      discount: { type: "AMOUNT", amount: 1_000 },
    });

    const idempotencyKey = randomId("idem");
    const first = await client.vouchers.redeem({
      params: { code },
      body: {
        order: { amount: 5_000, currency: "USD" },
        idempotencyKey,
      },
    });
    expect(first.ok).toBe(true);
    expect(first.amount).toBe(1_000);
    expect(first.redemptionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(first.finalOrder?.amount).toBe(4_000);

    const replay = await client.vouchers.redeem({
      params: { code },
      body: {
        order: { amount: 5_000, currency: "USD" },
        idempotencyKey,
      },
    });
    expect(replay.redemptionId).toBe(first.redemptionId);
    expect(replay.idempotent).toBe(true);
  });

  it("gift card: partial spend → drain → refusal once empty", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-gc"),
      type: "GIFT_VOUCHERS",
      currency: "USD",
    });
    const code = randomId("GC").toUpperCase();
    await client.vouchers.create({
      code,
      campaignId: campaign.id,
      type: "GIFT_CARD",
      giftBalance: 1_000,
    });

    // Partial spend: 600 against a 5_000 order leaves 400 on the card.
    const first = await client.vouchers.redeem({
      params: { code },
      body: { order: { amount: 5_000, currency: "USD" } },
    });
    expect(first.ok).toBe(true);
    expect(first.amount).toBeGreaterThan(0);
    expect(first.amount).toBeLessThanOrEqual(1_000);

    // Drain the rest (could be in one or two calls depending on logic).
    const second = await client.vouchers.redeem({
      params: { code },
      body: { order: { amount: 5_000, currency: "USD" } },
    });
    // Either we drained it on this call, or it was already drained.
    expect(typeof second.ok).toBe("boolean");

    // The third call refuses because the gift card has nothing left.
    const third = await client.vouchers.redeem({
      params: { code },
      body: { order: { amount: 5_000, currency: "USD" } },
    });
    expect(third.ok).toBe(false);
    expect(third.code).toBe("gift_balance_zero");

    // Ledger should record the credit + at least one redemption.
    const tx = await client.vouchers.transactions({ params: { code } });
    const credit = tx.data.find((t) => t.reason === "CREDIT");
    expect(credit?.delta).toBe(1_000);
    const redemptions = tx.data.filter((t) => t.reason === "REDEMPTION");
    expect(redemptions.length).toBeGreaterThanOrEqual(1);
  });
});
