import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@offerkit/db";
import { expirePoints } from "@offerkit/core/loyalty";
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

describe.skipIf(!E2E_ENABLED)("loyalty expiry sweep", () => {
  it("EARN with past expiresAt is expired by expirePoints(); balance reduced + EXPIRY row written", async () => {
    if (!db || !token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-loy-exp"),
      type: "LOYALTY_PROGRAM",
      currency: "USD",
    });
    const program = await client.loyalty.programs.create({
      campaignId: campaign.id,
    });
    await client.loyalty.tiers.create({
      programId: program.id,
      name: "default",
      threshold: 0,
      earnMultiplier: 10_000,
      sortOrder: 0,
    });
    const customer = await client.customers.create({
      email: `${randomId("loyx")}@example.com`,
    });
    const member = await client.loyalty.members.enroll({
      programId: program.id,
      customerId: customer.id,
    });

    // Earn with an already-past expiresAt.
    const past = new Date(Date.now() - 86_400_000).toISOString();
    const earn = await client.loyalty.members.earn({
      memberId: member.id,
      basePoints: 100,
      expiresAt: past,
    });
    expect(earn.balance).toBe(100);

    // Run the expiry sweep directly. Skips the worker.
    const result = await expirePoints(db);
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const history = await client.loyalty.members.history({ params: { id: member.id } });
    const expiry = history.data.find((t) => t.reason === "EXPIRY");
    expect(expiry).toBeDefined();
    expect(expiry?.delta).toBe(-100);

    // Final balance is 0 after expiry cancels the original earn.
    const updatedMember = await client.loyalty.members.get({ params: { id: member.id } });
    expect(updatedMember.balance).toBe(0);
  });
});
