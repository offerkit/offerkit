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
      discount: { type: "AMOUNT", amount: 500 },
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
      discount: { type: "AMOUNT", amount: 500 },
    });
    expect(result.generated).toBe(0);
    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("rejects discount bulk mint without a positive discount", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-bulk-empty"),
      type: "DISCOUNT",
      currency: "USD",
    });

    await expect(
      client.vouchers.bulk({
        campaignId: campaign.id,
        count: 5,
      }),
    ).rejects.toThrow(/positive discount/i);
  }, 30_000);

  it("rejects gift cards without a positive starting balance", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-gc-empty"),
      type: "GIFT_VOUCHERS",
      currency: "USD",
    });

    await expect(
      client.vouchers.create({
        code: randomId("GC-EMPTY").toUpperCase(),
        campaignId: campaign.id,
        type: "GIFT_CARD",
        giftBalance: 0,
      }),
    ).rejects.toThrow(/positive starting balance/i);
    await expect(
      client.vouchers.bulk({
        campaignId: campaign.id,
        count: 5,
      }),
    ).rejects.toThrow(/positive starting balance/i);
  }, 30_000);

  it("rejects discount vouchers in gift-voucher campaigns", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-gc-type"),
      type: "GIFT_VOUCHERS",
      currency: "USD",
    });

    await expect(
      client.vouchers.create({
        code: randomId("GC-WRONG").toUpperCase(),
        campaignId: campaign.id,
        type: "DISCOUNT",
        discount: { type: "AMOUNT", amount: 500 },
      }),
    ).rejects.toThrow(/gift voucher campaigns can only issue gift cards/i);
  }, 30_000);

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

    const fetched = await client.vouchers.get({ params: { code } });
    expect(fetched.id).toBe(created.id);

    const updated = await client.vouchers.update({
      params: { code },
      body: { patch: { active: false } },
    });
    expect(updated.active).toBe(false);

    await client.vouchers.delete({ params: { code } });

    await expect(client.vouchers.get({ params: { code } })).rejects.toThrow(/not found/i);
  });

  it("allows recreating a voucher code after soft delete", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-recreate"),
      type: "DISCOUNT",
      currency: "USD",
    });

    const code = randomId("V-REUSE").toUpperCase();
    const first = await client.vouchers.create({
      code,
      campaignId: campaign.id,
      type: "DISCOUNT",
      discount: { type: "AMOUNT", amount: 500 },
    });

    await expect(
      client.vouchers.create({
        code,
        campaignId: campaign.id,
        type: "DISCOUNT",
        discount: { type: "AMOUNT", amount: 500 },
      }),
    ).rejects.toThrow(/already exists/i);

    await client.vouchers.delete({ params: { code } });

    const recreated = await client.vouchers.create({
      code,
      campaignId: campaign.id,
      type: "DISCOUNT",
      discount: { type: "AMOUNT", amount: 700 },
    });
    expect(recreated.code).toBe(code);
    expect(recreated.id).not.toBe(first.id);
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

    const tx = await client.vouchers.transactions({ params: { code } });
    expect(Array.isArray(tx.data)).toBe(true);
    // Initial credit is recorded when the gift card is minted.
    const credit = tx.data.find((t) => t.reason === "CREDIT");
    expect(credit).toBeDefined();
    expect(credit?.delta).toBe(5_000);
    expect(credit?.balanceAfter).toBe(5_000);
  });

  it("generates codes, supports percent discounts, updates gift-card balances, and qualifies customer vouchers", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const customer = await client.customers.create({
      email: `${randomId("voucher-customer")}@example.com`,
    });
    const campaign = await client.campaigns.create({
      name: randomId("camp-voucher-generated"),
      type: "DISCOUNT",
      currency: "USD",
      codeConfig: { prefix: "AUTO", length: 10 },
    });
    await client.campaigns.update({
      params: { id: campaign.id },
      body: { patch: { status: "active" } },
    });

    const generated = await client.vouchers.create({
      campaignId: campaign.id,
      type: "DISCOUNT",
      discount: { type: "PERCENTAGE", percent: 1_000, maxDiscountAmount: 700 },
      redemptionLimit: 3,
      perUserRedemptionLimit: 1,
      priority: 5,
      exclusive: true,
      customerId: customer.id,
      metadata: { source: "generated" },
    });
    expect(generated.code.startsWith("AUTO")).toBe(true);
    expect(generated.discount?.type).toBe("PERCENTAGE");

    const qualified = await client.vouchers.qualify({
      customerId: customer.id,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(qualified.eligible.find((item) => item.code === generated.code)).toBeDefined();

    const updated = await client.vouchers.update({
      params: { code: generated.code },
      body: {
        patch: {
          discount: { type: "AMOUNT", amount: 600 },
          redemptionLimit: 4,
          perUserRedemptionLimit: 2,
          priority: 10,
          exclusive: false,
          startDate: new Date(Date.now() - 1_000).toISOString(),
          endDate: new Date(Date.now() + 86_400_000).toISOString(),
          metadata: { source: "updated" },
        },
      },
    });
    expect(updated.discount?.type).toBe("AMOUNT");
    expect(updated.redemptionLimit).toBe(4);
    expect(updated.perUserRedemptionLimit).toBe(2);

    await expect(
      client.vouchers.create({
        campaignId: crypto.randomUUID(),
        type: "DISCOUNT",
        discount: { type: "AMOUNT", amount: 100 },
      }),
    ).rejects.toThrow(/campaign not found/i);

    const giftCampaign = await client.campaigns.create({
      name: randomId("camp-gift-bulk"),
      type: "GIFT_VOUCHERS",
      currency: "USD",
    });
    const bulkGift = await client.vouchers.bulk({
      campaignId: giftCampaign.id,
      count: 2,
      giftBalance: 2_000,
    });
    expect(bulkGift.generated).toBe(2);
    const [gift] = (await client.vouchers.list({ campaignId: giftCampaign.id, limit: 2 })).data;
    if (!gift) throw new Error("expected gift card");
    const adjustedGift = await client.vouchers.update({
      params: { code: gift.code },
      body: { patch: { giftBalance: 2_500 } },
    });
    expect(adjustedGift.giftBalance).toBe(2_500);
    const tx = await client.vouchers.transactions({ params: { code: gift.code } });
    expect(tx.data.find((item) => item.reason === "ADJUSTMENT")?.delta).toBe(500);
  });
});
