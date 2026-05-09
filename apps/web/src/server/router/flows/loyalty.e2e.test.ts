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
    const history = await client.loyalty.members.history({ id: member.id });
    expect(history.data.length).toBeGreaterThanOrEqual(2);
    expect(history.data.find((t) => t.reason === "EARN")).toBeDefined();
    expect(history.data.find((t) => t.reason === "REDEEM")).toBeDefined();

    // Verify tier listing works too.
    const tiers = await client.loyalty.tiers.list({ programId: program.id });
    expect(tiers.data.map((t) => t.id).sort()).toEqual(
      [bronze.id, gold.id].sort(),
    );
  });
});
