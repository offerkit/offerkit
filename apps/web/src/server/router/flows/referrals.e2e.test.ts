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
  rawRequest,
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
  it("returns a conflict when creating a second active program for a campaign", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-ref-dupe"),
      type: "REFERRAL_PROGRAM",
      currency: "USD",
    });
    const referrerReward = {
      kind: "discount" as const,
      discount: { type: "AMOUNT" as const, amount: 1_000 },
    };
    const refereeReward = {
      kind: "discount" as const,
      discount: { type: "AMOUNT" as const, amount: 500 },
    };

    await client.referrals.programs.create({
      campaignId: campaign.id,
      referrerReward,
      refereeReward,
    });

    const response = await rawRequest(
      new Request("http://test.local/api/v1/referral-programs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          campaignId: campaign.id,
          referrerReward,
          refereeReward,
        }),
      }),
    );

    expect(response.status).toBe(409);
    await expect(response.text()).resolves.toMatch(/active referral program/i);
  });

  it("allows creating a new program for a campaign after soft delete", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const campaign = await client.campaigns.create({
      name: randomId("camp-ref-recreate"),
      type: "REFERRAL_PROGRAM",
      currency: "USD",
    });
    const referrerReward = {
      kind: "discount" as const,
      discount: { type: "AMOUNT" as const, amount: 1_000 },
    };
    const refereeReward = {
      kind: "discount" as const,
      discount: { type: "AMOUNT" as const, amount: 500 },
    };

    const deleted = await client.referrals.programs.create({
      campaignId: campaign.id,
      referrerReward,
      refereeReward,
    });
    await client.referrals.programs.delete({ params: { id: deleted.id } });

    const recreated = await client.referrals.programs.create({
      campaignId: campaign.id,
      referrerReward,
      refereeReward,
    });

    expect(recreated.id).not.toBe(deleted.id);
    expect(recreated.campaignId).toBe(campaign.id);

    const fetched = await client.referrals.programs.get({ params: { id: recreated.id } });
    expect(fetched.id).toBe(recreated.id);
    const updated = await client.referrals.programs.update({
      params: { id: recreated.id },
      body: {
        patch: {
          codeLength: 10,
          metadata: { source: "e2e" },
        },
      },
    });
    expect(updated.codeLength).toBe(10);
    const programs = await client.referrals.programs.list({ limit: 10 });
    expect(programs.data.find((item) => item.id === recreated.id)).toBeDefined();
  });

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

    const secondReferrer = await client.customers.create({
      email: `${randomId("rrf2")}@example.com`,
    });
    await client.referrals.issue({
      programId: program.id,
      referrerCustomerId: secondReferrer.id,
      prefix: "REF",
    });
    const codesPage = await client.referrals.listCodes({
      params: { programId: program.id },
      query: { limit: 1 },
    });
    expect(codesPage.data).toHaveLength(1);
    expect(codesPage.next).toBeDefined();
    const codesPageTwo = await client.referrals.listCodes({
      params: { programId: program.id },
      query: { limit: 1, cursor: codesPage.next },
    });
    expect(codesPageTwo.data).toHaveLength(1);

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
      query: { limit: 1 },
    });
    expect(conversions.data).toHaveLength(1);
    expect(conversions.next).toBeDefined();
    const conversionsPageTwo = await client.referrals.listConversions({
      params: { codeId: issuedCodeId },
      query: { limit: 10, cursor: conversions.next },
    });
    expect(conversionsPageTwo.data.length).toBeGreaterThanOrEqual(2);

    const programConversions = await client.referrals.listProgramConversions({
      params: { programId: program.id },
      query: { limit: 1 },
    });
    expect(programConversions.data).toHaveLength(1);
    expect(programConversions.next).toBeDefined();
    expect(programConversions.data[0]?.code).toBe(issuedCode);
    expect(programConversions.data[0]?.referrerCustomerId).toBe(referrer.id);
    expect(programConversions.data[0]?.referrerOutcome.voucherCode).toBeDefined();
  });
});
