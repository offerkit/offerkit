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

describe.skipIf(!E2E_ENABLED)("insights summary", () => {
  it("redeem a few vouchers across 2 campaigns → summary counters reflect them", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    // Two campaigns, two vouchers, two redemptions per campaign = 4 total.
    const campaigns: string[] = [];
    const codes: string[] = [];
    for (let i = 0; i < 2; i++) {
      const camp = await client.campaigns.create({
        name: randomId(`camp-ins-${String(i)}`),
        type: "DISCOUNT",
        currency: "USD",
      });
      campaigns.push(camp.id);
      for (let j = 0; j < 2; j++) {
        const code = randomId(`INS${String(i)}${String(j)}`).toUpperCase();
        await client.vouchers.create({
          code,
          campaignId: camp.id,
          type: "DISCOUNT",
          discount: { type: "AMOUNT", amount: 100 },
          redemptionLimit: 1,
        });
        codes.push(code);
      }
    }

    for (const code of codes) {
      const r = await client.vouchers.redeem({
        code,
        order: { amount: 5_000, currency: "USD" },
      });
      expect(r.ok).toBe(true);
    }

    const summary = await client.insights.summary({});
    expect(summary.counters.redemptionsToday).toBeGreaterThanOrEqual(4);
    expect(summary.counters.redemptions7d).toBeGreaterThanOrEqual(4);
    expect(summary.counters.redemptions30d).toBeGreaterThanOrEqual(4);
    // daily contains one row per day-with-redemptions in the window.
    expect(summary.daily.length).toBeGreaterThanOrEqual(1);
    expect(summary.daily.length).toBeLessThanOrEqual(30);
    // topCampaigns is LIMIT 5 globally, so our fresh campaigns may not
    // dominate after repeated test runs. Just confirm the shape and that
    // at least one campaign appears.
    expect(summary.topCampaigns.length).toBeGreaterThanOrEqual(1);
    void campaigns;
  });
});
