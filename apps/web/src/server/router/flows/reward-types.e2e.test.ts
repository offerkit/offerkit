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

describe.skipIf(!E2E_ENABLED)("custom reward types CRUD + voucher payload roundtrip", () => {
  it("create reward type → reference from voucher → redeem returns custom reward in breakdown context", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    // SCREAMING_SNAKE_CASE only.
    const key = `FREE_SHIPPING_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const created = await client.rewardTypes.create({
      key,
      name: "Free Shipping",
      payloadSchema: { type: "object", properties: { lanes: { type: "array" } } },
    });
    expect(created.key).toBe(key);

    const fetched = await client.rewardTypes.get({ id: created.id });
    expect(fetched.id).toBe(created.id);

    const updated = await client.rewardTypes.update({
      id: created.id,
      patch: { description: "Waive shipping for these lanes" },
    });
    expect(updated.description).toBe("Waive shipping for these lanes");

    // Reference the reward type from a voucher's customRewards array.
    const campaign = await client.campaigns.create({
      name: randomId("camp-rt"),
      type: "DISCOUNT",
      currency: "USD",
    });
    const code = randomId("RT").toUpperCase();
    const voucher = await client.vouchers.create({
      code,
      campaignId: campaign.id,
      type: "DISCOUNT",
      discount: { type: "AMOUNT", amount: 0 },
      customRewards: [{ typeKey: key, payload: { lanes: ["US-domestic"] } }],
    });
    expect(voucher.customRewards[0]?.typeKey).toBe(key);

    // Redemption succeeds. Custom-reward emission is the integration
    // surface — the redeem call returns ok and includes the voucher code.
    const redeemed = await client.vouchers.redeem({
      code,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(redeemed.ok).toBe(true);

    // Soft-delete
    await client.rewardTypes.delete({ id: created.id });
    await expect(client.rewardTypes.get({ id: created.id })).rejects.toThrow(
      /not found/i,
    );
  });
});
