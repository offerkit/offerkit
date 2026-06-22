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

describe.skipIf(!E2E_ENABLED)("promotions tiers + qualification", () => {
  it("creates, lists, updates, qualifies, and soft-deletes promotion tiers", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-promo"),
      type: "PROMOTION",
      currency: "USD",
      autoApply: true,
    });
    await client.campaigns.update({
      params: { id: campaign.id },
      body: { patch: { status: "active" } },
    });

    const tier = await client.promotions.tiers.create({
      campaignId: campaign.id,
      name: "10 USD off",
      description: "starter promotion",
      effect: { type: "AMOUNT", amount: 1_000 },
      active: true,
      priority: 10,
      metadata: { source: "e2e" },
    });
    expect(tier.campaignId).toBe(campaign.id);
    expect(tier.active).toBe(true);

    const listed = await client.promotions.tiers.list({
      campaignId: campaign.id,
      limit: 5,
    });
    expect(listed.data.find((item) => item.id === tier.id)).toBeDefined();

    const updated = await client.promotions.tiers.update({
      params: { id: tier.id },
      body: {
        patch: {
          name: "12 USD off",
          description: "updated promotion",
          effect: { type: "AMOUNT", amount: 1_200 },
          priority: 20,
          metadata: { updated: true },
        },
      },
    });
    expect(updated.name).toBe("12 USD off");
    expect(updated.description).toBe("updated promotion");
    expect(updated.priority).toBe(20);

    const qualified = await client.promotions.qualify({
      order: { amount: 5_000, currency: "USD" },
      filters: { campaignIds: [campaign.id] },
    });
    expect(qualified.eligible).toHaveLength(1);
    expect(qualified.eligible[0]?.promotionTierId).toBe(tier.id);
    expect(qualified.preview.amount).toBe(1_200);
    expect(qualified.preview.finalOrder.amount).toBe(3_800);

    await client.promotions.tiers.delete({ params: { id: tier.id } });
    const afterDelete = await client.promotions.tiers.list({
      campaignId: campaign.id,
      limit: 5,
    });
    expect(afterDelete.data.find((item) => item.id === tier.id)).toBeUndefined();
  });

  it("returns qualification skips for campaign, tier, currency, date, and rule failures", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const rule = await client.validationRules.create({
      name: randomId("promo-rule"),
      appliesTo: "promotion",
      rule: { ">=": [{ var: "order.amount" }, 10_000] },
    });

    const draftCampaign = await client.campaigns.create({
      name: randomId("camp-promo-draft"),
      type: "PROMOTION",
      currency: "USD",
      autoApply: true,
    });
    const activeCampaign = await client.campaigns.create({
      name: randomId("camp-promo-active"),
      type: "PROMOTION",
      currency: "USD",
      autoApply: true,
    });
    const eurCampaign = await client.campaigns.create({
      name: randomId("camp-promo-eur"),
      type: "PROMOTION",
      currency: "EUR",
      autoApply: true,
    });
    const futureCampaign = await client.campaigns.create({
      name: randomId("camp-promo-future"),
      type: "PROMOTION",
      currency: "USD",
      autoApply: true,
      startDate: new Date(Date.now() + 86_400_000).toISOString(),
    });
    await Promise.all(
      [activeCampaign.id, eurCampaign.id, futureCampaign.id].map((id) =>
        client.campaigns.update({
          params: { id },
          body: { patch: { status: "active" } },
        }),
      ),
    );

    const draftTier = await client.promotions.tiers.create({
      campaignId: draftCampaign.id,
      name: "draft campaign",
      effect: { type: "AMOUNT", amount: 100 },
    });
    const inactiveTier = await client.promotions.tiers.create({
      campaignId: activeCampaign.id,
      name: "inactive tier",
      effect: { type: "AMOUNT", amount: 100 },
      active: false,
    });
    const futureTier = await client.promotions.tiers.create({
      campaignId: activeCampaign.id,
      name: "future tier",
      effect: { type: "AMOUNT", amount: 100 },
      startDate: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const ruleTier = await client.promotions.tiers.create({
      campaignId: activeCampaign.id,
      name: "rule tier",
      effect: { type: "AMOUNT", amount: 100 },
      validationRuleId: rule.id,
    });
    const eurTier = await client.promotions.tiers.create({
      campaignId: eurCampaign.id,
      name: "eur tier",
      effect: { type: "AMOUNT", amount: 100 },
    });
    const futureCampaignTier = await client.promotions.tiers.create({
      campaignId: futureCampaign.id,
      name: "future campaign",
      effect: { type: "AMOUNT", amount: 100 },
    });

    const result = await client.promotions.qualify({
      order: { amount: 5_000, currency: "USD" },
      filters: {
        campaignIds: [draftCampaign.id, activeCampaign.id, eurCampaign.id, futureCampaign.id],
      },
    });

    expect(result.eligible).toHaveLength(0);
    expect(result.preview.amount).toBe(0);
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          promotionTierId: draftTier.id,
          reason: "campaign_inactive",
        }),
        expect.objectContaining({
          promotionTierId: inactiveTier.id,
          reason: "promotion_inactive",
        }),
        expect.objectContaining({
          promotionTierId: futureTier.id,
          reason: "promotion_not_active",
        }),
        expect.objectContaining({
          promotionTierId: ruleTier.id,
          reason: "rule_failed",
        }),
        expect.objectContaining({
          promotionTierId: eurTier.id,
          reason: "currency_mismatch",
        }),
        expect.objectContaining({
          promotionTierId: futureCampaignTier.id,
          reason: "campaign_not_active",
        }),
      ]),
    );

    const hiddenSkips = await client.promotions.qualify({
      order: { amount: 5_000, currency: "USD" },
      filters: {
        campaignIds: [draftCampaign.id],
        includeSkipped: false,
      },
    });
    expect(hiddenSkips.skipped).toHaveLength(0);
  });

  it("reports exclusive promotion losers and zero-after-total skips", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-promo-exclusive"),
      type: "PROMOTION",
      currency: "USD",
      autoApply: true,
    });
    await client.campaigns.update({
      params: { id: campaign.id },
      body: { patch: { status: "active" } },
    });

    const exclusive = await client.promotions.tiers.create({
      campaignId: campaign.id,
      name: "exclusive",
      effect: { type: "AMOUNT", amount: 500 },
      priority: 100,
      exclusive: true,
    });
    const loser = await client.promotions.tiers.create({
      campaignId: campaign.id,
      name: "exclusive loser",
      effect: { type: "AMOUNT", amount: 300 },
      priority: 1,
    });
    const zero = await client.promotions.tiers.create({
      campaignId: campaign.id,
      name: "zero after total",
      effect: { type: "AMOUNT", amount: 0 },
      priority: 0,
    });

    const exclusiveResult = await client.promotions.qualify({
      order: { amount: 2_000, currency: "USD" },
      filters: { campaignIds: [campaign.id] },
    });
    expect(exclusiveResult.eligible.map((item) => item.promotionTierId)).toContain(
      exclusive.id,
    );
    expect(exclusiveResult.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          promotionTierId: loser.id,
          reason: "exclusivity_lost",
        }),
        expect.objectContaining({
          promotionTierId: zero.id,
          reason: "exclusivity_lost",
        }),
      ]),
    );

    await client.promotions.tiers.update({
      params: { id: exclusive.id },
      body: { patch: { active: false } },
    });
    const zeroResult = await client.promotions.qualify({
      order: { amount: 300, currency: "USD" },
      filters: { campaignIds: [campaign.id] },
    });
    expect(zeroResult.eligible.map((item) => item.promotionTierId)).toContain(loser.id);
    expect(zeroResult.skipped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          promotionTierId: zero.id,
          reason: "zero_after_running_total",
        }),
      ]),
    );
  });
});
