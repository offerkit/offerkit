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

async function makeDiscountVoucher(
  client: ReturnType<typeof makeClient>,
  campaignId: string,
  amount: number,
): Promise<string> {
  const code = randomId("STK").toUpperCase();
  await client.vouchers.create({
    code,
    campaignId,
    type: "DISCOUNT",
    discount: { type: "AMOUNT", amount },
  });
  return code;
}

describe.skipIf(!E2E_ENABLED)("stackable redemption", () => {
  it("3 codes redeemed atomically + idempotency replay returns same batchId", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-stack"),
      type: "DISCOUNT",
      currency: "USD",
    });

    const c1 = await makeDiscountVoucher(client, campaign.id, 500);
    const c2 = await makeDiscountVoucher(client, campaign.id, 700);
    const c3 = await makeDiscountVoucher(client, campaign.id, 300);

    const idempotencyKey = randomId("stk-idem");
    const first = await client.vouchers.stackRedeem({
      codes: [c1, c2, c3],
      order: { amount: 5_000, currency: "USD" },
      idempotencyKey,
    });
    expect(first.ok).toBe(true);
    expect(first.entries).toHaveLength(3);
    expect(first.batchId).toMatch(/^[0-9a-f-]{36}$/);

    const replay = await client.vouchers.stackRedeem({
      codes: [c1, c2, c3],
      order: { amount: 5_000, currency: "USD" },
      idempotencyKey,
    });
    expect(replay.batchId).toBe(first.batchId);
    expect(replay.idempotent).toBe(true);
  });

  it("gift card in a stack returns voucher_disabled or similar refusal", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const discCampaign = await client.campaigns.create({
      name: randomId("camp-stack-disc"),
      type: "DISCOUNT",
      currency: "USD",
    });
    const gcCampaign = await client.campaigns.create({
      name: randomId("camp-stack-gc"),
      type: "GIFT_VOUCHERS",
      currency: "USD",
    });

    const disc = await makeDiscountVoucher(client, discCampaign.id, 500);

    const gcCode = randomId("GC-STK").toUpperCase();
    await client.vouchers.create({
      code: gcCode,
      campaignId: gcCampaign.id,
      type: "GIFT_CARD",
      giftBalance: 1_000,
    });

    const result = await client.vouchers.stackRedeem({
      codes: [disc, gcCode],
      order: { amount: 5_000, currency: "USD" },
    });
    expect(result.ok).toBe(false);
    expect(typeof result.code).toBe("string");
  });
});
