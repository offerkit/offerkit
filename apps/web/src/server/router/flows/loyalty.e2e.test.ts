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

describe.skipIf(!E2E_ENABLED)("loyalty: enroll → earn → tier → redeem → history", () => {
  it("full loyalty round-trip with two tiers and a discount reward", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-loy"),
      type: "LOYALTY_PROGRAM",
      currency: "USD",
    });
    const program = await client.loyalty.programs.create({
      campaignId: campaign.id,
    });

    const bronze = await client.loyalty.tiers.create({
      programId: program.id,
      name: "bronze",
      threshold: 0,
      earnMultiplier: 10_000,
      sortOrder: 0,
    });
    const gold = await client.loyalty.tiers.create({
      programId: program.id,
      name: "gold",
      threshold: 100,
      earnMultiplier: 20_000,
      sortOrder: 1,
    });

    const reward = await client.loyalty.rewards.create({
      programId: program.id,
      name: "5 USD off",
      cost: 50,
      payload: {
        kind: "discount",
        discount: { type: "AMOUNT", amount: 500 },
      },
    });

    const customer = await client.customers.create({
      email: `${randomId("loyc")}@example.com`,
    });
    const member = await client.loyalty.members.enroll({
      programId: program.id,
      customerId: customer.id,
    });
    expect(member.balance).toBe(0);

    // Earn enough to cross the gold threshold (100 lifetime points).
    const earn = await client.loyalty.members.earn({
      memberId: member.id,
      basePoints: 200,
    });
    expect(earn.ok).toBe(true);
    expect(earn.balance).toBeGreaterThanOrEqual(200);
    expect(earn.lifetimePoints).toBeGreaterThanOrEqual(200);
    expect(earn.tierId).toBe(gold.id);

    // Redeem the reward — should decrement balance by cost.
    const redeem = await client.loyalty.members.redeem({
      memberId: member.id,
      rewardId: reward.id,
    });
    expect(redeem.ok).toBe(true);
    expect(redeem.cost).toBe(50);
    expect(redeem.balance).toBe((earn.balance ?? 0) - 50);
    expect(redeem.payload?.kind).toBe("discount");

    // History should include EARN and REDEEM rows.
    const history = await client.loyalty.members.history({ params: { id: member.id } });
    expect(history.data.length).toBeGreaterThanOrEqual(2);
    expect(history.data.find((t) => t.reason === "EARN")).toBeDefined();
    expect(history.data.find((t) => t.reason === "REDEEM")).toBeDefined();

    // Verify tier listing works too.
    const tiers = await client.loyalty.tiers.list({ params: { programId: program.id } });
    expect(tiers.data.map((t) => t.id).sort()).toEqual(
      [bronze.id, gold.id].sort(),
    );
  });

  it("covers program, tier, earning-rule, reward, and member management paths", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-loy-admin"),
      type: "LOYALTY_PROGRAM",
      currency: "USD",
    });
    const program = await client.loyalty.programs.create({
      campaignId: campaign.id,
      pointsExpiryDays: 30,
      metadata: { source: "e2e" },
    });

    const fetchedProgram = await client.loyalty.programs.get({ params: { id: program.id } });
    expect(fetchedProgram.pointsExpiryDays).toBe(30);
    const updatedProgram = await client.loyalty.programs.update({
      params: { id: program.id },
      body: { patch: { pointsExpiryDays: null, metadata: { updated: true } } },
    });
    expect(updatedProgram.pointsExpiryDays).toBeNull();
    const programs = await client.loyalty.programs.list({ limit: 5 });
    expect(programs.data.find((item) => item.id === program.id)).toBeDefined();

    const tier = await client.loyalty.tiers.create({
      programId: program.id,
      name: "silver",
      threshold: 10,
      earnMultiplier: 12_000,
      sortOrder: 1,
    });
    const updatedTier = await client.loyalty.tiers.update({
      params: { id: tier.id },
      body: { patch: { name: "silver plus", threshold: 20, earnMultiplier: 15_000 } },
    });
    expect(updatedTier.name).toBe("silver plus");
    const listedTiers = await client.loyalty.tiers.list({ params: { programId: program.id } });
    expect(listedTiers.data.find((item) => item.id === tier.id)).toBeDefined();

    const earningRule = await client.loyalty.earningRules.create({
      programId: program.id,
      name: "order points",
      event: "order.paid",
      formula: { kind: "fixed", value: 25 },
    });
    const updatedRule = await client.loyalty.earningRules.update({
      params: { id: earningRule.id },
      body: {
        patch: {
          name: "paid order points",
          event: "order.fulfilled",
          formula: { kind: "per_cents", divisor: 100 },
          active: "no",
        },
      },
    });
    expect(updatedRule.active).toBe("no");
    const earningRules = await client.loyalty.earningRules.list({
      params: { programId: program.id },
    });
    expect(earningRules.data.find((item) => item.id === earningRule.id)).toBeDefined();

    const reward = await client.loyalty.rewards.create({
      programId: program.id,
      name: "small gift card",
      description: "admin reward",
      cost: 10,
      payload: { kind: "gift_card", creditCents: 500 },
    });
    const updatedReward = await client.loyalty.rewards.update({
      params: { id: reward.id },
      body: {
        patch: {
          name: "custom reward",
          description: "updated reward",
          cost: 15,
          payload: { kind: "custom", typeKey: "BONUS", payload: { value: 1 } },
        },
      },
    });
    expect(updatedReward.name).toBe("custom reward");
    const rewards = await client.loyalty.rewards.list({ params: { programId: program.id } });
    expect(rewards.data.find((item) => item.id === reward.id)).toBeDefined();

    const customer = await client.customers.create({
      email: `${randomId("loyadmin")}@example.com`,
    });
    const member = await client.loyalty.members.enroll({
      programId: program.id,
      customerId: customer.id,
    });
    const duplicateEnroll = await client.loyalty.members.enroll({
      programId: program.id,
      customerId: customer.id,
    });
    expect(duplicateEnroll.id).toBe(member.id);
    const listedMembers = await client.loyalty.members.list({
      params: { programId: program.id },
      query: { limit: 5 },
    });
    expect(listedMembers.data.find((item) => item.id === member.id)).toBeDefined();
    const adjusted = await client.loyalty.members.adjust({
      memberId: member.id,
      delta: 40,
      note: "manual admin credit",
    });
    expect(adjusted.ok).toBe(true);
    expect(adjusted.balance).toBe(40);
    const fetchedMember = await client.loyalty.members.get({ params: { id: member.id } });
    expect(fetchedMember.balance).toBe(40);

    await client.loyalty.rewards.delete({ params: { id: reward.id } });
    const rewardsAfterDelete = await client.loyalty.rewards.list({
      params: { programId: program.id },
    });
    expect(rewardsAfterDelete.data.find((item) => item.id === reward.id)).toBeUndefined();
    await client.loyalty.earningRules.delete({ params: { id: earningRule.id } });
    const rulesAfterDelete = await client.loyalty.earningRules.list({
      params: { programId: program.id },
    });
    expect(rulesAfterDelete.data.find((item) => item.id === earningRule.id)).toBeUndefined();
    await client.loyalty.tiers.delete({ params: { id: tier.id } });
    const tiersAfterDelete = await client.loyalty.tiers.list({
      params: { programId: program.id },
    });
    expect(tiersAfterDelete.data.find((item) => item.id === tier.id)).toBeUndefined();
    await client.loyalty.programs.delete({ params: { id: program.id } });
    await expect(client.loyalty.programs.get({ params: { id: program.id } })).rejects.toThrow(
      /not found/i,
    );
  });
});
