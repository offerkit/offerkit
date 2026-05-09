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

describe.skipIf(!E2E_ENABLED)("referrals: program → issue → convert → both rewards", () => {
  it("issues a code for the referrer and converts it for the referee", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-ref"),
      type: "REFERRAL_PROGRAM",
      currency: "USD",
    });
    const program = await client.referrals.programs.create({
      campaignId: campaign.id,
      referrerReward: {
        kind: "discount",
        discount: { type: "AMOUNT", amount: 1_000 },
      },
      refereeReward: {
        kind: "discount",
        discount: { type: "AMOUNT", amount: 500 },
      },
    });

    const referrer = await client.customers.create({
      email: `${randomId("rrf")}@example.com`,
    });
    const referee = await client.customers.create({
      email: `${randomId("rfe")}@example.com`,
    });

    const issued = await client.referrals.issue({
      programId: program.id,
      referrerCustomerId: referrer.id,
      prefix: "REF",
    });
    expect(issued.ok).toBe(true);
    const issuedCode = issued.code;
    if (!issuedCode) throw new Error("expected issued code");
    expect(issuedCode.startsWith("REF-")).toBe(true);

    const lookup = await client.referrals.getByCode({ code: issuedCode });
    expect(lookup.referrerCustomerId).toBe(referrer.id);
    expect(lookup.status).toBe("issued");

    const converted = await client.referrals.convert({
      code: issuedCode,
      refereeCustomerId: referee.id,
    });
    expect(converted.ok).toBe(true);
    expect(converted.referrerReward?.kind).toBe("discount");
    expect(converted.refereeReward?.kind).toBe("discount");
    expect(converted.referrerReward?.voucherCode).toBeDefined();
    expect(converted.refereeReward?.voucherCode).toBeDefined();

    const after = await client.referrals.getByCode({ code: issuedCode });
    expect(after.status).toBe("converted");
    expect(after.refereeCustomerId).toBe(referee.id);
  });
});
