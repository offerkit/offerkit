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
  it("issues a stable code and supports many conversions per code", async () => {
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
    const refereeA = await client.customers.create({
      email: `${randomId("rfeA")}@example.com`,
    });
    const refereeB = await client.customers.create({
      email: `${randomId("rfeB")}@example.com`,
    });

    const issued = await client.referrals.issue({
      programId: program.id,
      referrerCustomerId: referrer.id,
      prefix: "REF",
    });
    expect(issued.ok).toBe(true);
    const issuedCode = issued.code;
    const issuedCodeId = issued.codeId;
    if (!issuedCode || !issuedCodeId) throw new Error("expected issued code");
    expect(issuedCode.startsWith("REF-")).toBe(true);

    // Re-issuing returns the same stable code.
    const reissued = await client.referrals.issue({
      programId: program.id,
      referrerCustomerId: referrer.id,
    });
    expect(reissued.code).toBe(issuedCode);
    expect(reissued.codeId).toBe(issuedCodeId);

    const lookup = await client.referrals.getByCode({ params: { code: issuedCode } });
    expect(lookup.referrerCustomerId).toBe(referrer.id);
    expect(lookup.id).toBe(issuedCodeId);

    // First friend converts.
    const convertedA = await client.referrals.convert({
      code: issuedCode,
      refereeCustomerId: refereeA.id,
    });
    expect(convertedA.ok).toBe(true);
    expect(convertedA.codeId).toBe(issuedCodeId);
    expect(convertedA.idempotent).toBe(false);
    expect(convertedA.referrerReward?.voucherCode).toBeDefined();
    expect(convertedA.refereeReward?.voucherCode).toBeDefined();

    // Second friend converts on the same code — refer-a-friend semantics.
    const convertedB = await client.referrals.convert({
      code: issuedCode,
      refereeCustomerId: refereeB.id,
    });
    expect(convertedB.ok).toBe(true);
    expect(convertedB.codeId).toBe(issuedCodeId);
    expect(convertedB.conversionId).not.toBe(convertedA.conversionId);
    expect(convertedB.referrerReward?.voucherCode).toBeDefined();
    expect(convertedB.referrerReward?.voucherCode).not.toBe(
      convertedA.referrerReward?.voucherCode,
    );

    // Same referee can't convert twice.
    const convertedAReplay = await client.referrals.convert({
      code: issuedCode,
      refereeCustomerId: refereeA.id,
    });
    expect(convertedAReplay.ok).toBe(false);
    expect(convertedAReplay.errorCode).toBe("referee_already_converted");

    // Self-referral rejected.
    const selfRef = await client.referrals.convert({
      code: issuedCode,
      refereeCustomerId: referrer.id,
    });
    expect(selfRef.ok).toBe(false);
    expect(selfRef.errorCode).toBe("self_referral");

    // conversionEventId replay returns the same outcome idempotently.
    const refereeC = await client.customers.create({
      email: `${randomId("rfeC")}@example.com`,
    });
    const eventId = randomId("evt");
    const convertedC = await client.referrals.convert({
      code: issuedCode,
      refereeCustomerId: refereeC.id,
      conversionEventId: eventId,
    });
    expect(convertedC.ok).toBe(true);
    expect(convertedC.idempotent).toBe(false);
    const convertedCReplay = await client.referrals.convert({
      code: issuedCode,
      refereeCustomerId: refereeC.id,
      conversionEventId: eventId,
    });
    expect(convertedCReplay.ok).toBe(true);
    expect(convertedCReplay.idempotent).toBe(true);
    expect(convertedCReplay.conversionId).toBe(convertedC.conversionId);

    const conversions = await client.referrals.listConversions({
      params: { codeId: issuedCodeId },
      query: { limit: 10 },
    });
    expect(conversions.data.length).toBe(3);
  });
});
