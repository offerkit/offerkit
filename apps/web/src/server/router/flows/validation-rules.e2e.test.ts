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

describe.skipIf(!E2E_ENABLED)("validation rules CRUD + attach to campaign", () => {
  it("create rule → attach to campaign → update rule → soft-delete", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const tag = randomId("rule");
    const rule = await client.validationRules.create({
      name: tag,
      rule: { ">=": [{ var: "order.amount" }, 1_000] },
      appliesTo: "voucher",
    });
    expect(rule.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(rule.appliesTo).toBe("voucher");

    const campaign = await client.campaigns.create({
      name: randomId("camp-rule"),
      type: "DISCOUNT",
      currency: "USD",
      validationRuleId: rule.id,
    });
    expect(campaign.validationRuleId).toBe(rule.id);

    const updated = await client.validationRules.update({
      params: { id: rule.id },
      body: { patch: { description: "min order 1000 minor units" } },
    });
    expect(updated.description).toBe("min order 1000 minor units");

    // Detach so the FK doesn't block the soft-delete.
    await client.campaigns.update({
      params: { id: campaign.id },
      body: { patch: { validationRuleId: null } },
    });

    await client.validationRules.delete({ params: { id: rule.id } });

    await expect(client.validationRules.get({ params: { id: rule.id } })).rejects.toThrow(
      /not found/i,
    );
  });
});
