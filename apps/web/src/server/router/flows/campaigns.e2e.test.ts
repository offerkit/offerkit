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

describe.skipIf(!E2E_ENABLED)("campaigns CRUD", () => {
  it("create → update → list (search) → soft-delete excludes from list", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const name = randomId("camp");
    const created = await client.campaigns.create({
      name,
      type: "DISCOUNT",
      currency: "USD",
    });
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.name).toBe(name);

    const updated = await client.campaigns.update({
      params: { id: created.id },
      body: { patch: { description: "tagged for e2e" } },
    });
    expect(updated.description).toBe("tagged for e2e");

    const search = await client.campaigns.list({ search: name, limit: 5 });
    expect(search.data.find((c) => c.id === created.id)).toBeDefined();

    await client.campaigns.delete({ params: { id: created.id } });

    const after = await client.campaigns.list({ search: name, limit: 5 });
    expect(after.data.find((c) => c.id === created.id)).toBeUndefined();

    // get on a soft-deleted row returns NOT_FOUND.
    await expect(client.campaigns.get({ params: { id: created.id } })).rejects.toThrow(
      /not found/i,
    );
  });

  it("updates optional campaign fields used by qualification and code generation", async () => {
    if (!token) throw new Error("setup failed");
    const client = makeClient(token);

    const rule = await client.validationRules.create({
      name: randomId("camp-rule"),
      appliesTo: "voucher",
      rule: { ">=": [{ var: "order.amount" }, 100] },
    });
    const created = await client.campaigns.create({
      name: randomId("camp-full"),
      type: "DISCOUNT",
      currency: "USD",
      timezone: "UTC",
      startDate: new Date(Date.now() + 3_600_000).toISOString(),
      endDate: new Date(Date.now() + 7_200_000).toISOString(),
      codeConfig: { prefix: "FULL", length: 10 },
      validationRuleId: rule.id,
      perUserRedemptionLimit: 2,
      autoApply: true,
      metadata: { source: "create" },
    });

    const updated = await client.campaigns.update({
      params: { id: created.id },
      body: {
        patch: {
          name: `${created.name}-updated`,
          status: "active",
          currency: "EUR",
          timezone: "Europe/Amsterdam",
          startDate: new Date(Date.now() + 10_800_000).toISOString(),
          endDate: new Date(Date.now() + 14_400_000).toISOString(),
          codeConfig: { prefix: "UPD", length: 12 },
          validationRuleId: rule.id,
          perUserRedemptionLimit: 3,
          autoApply: false,
          metadata: { source: "update" },
        },
      },
    });

    expect(updated.name).toBe(`${created.name}-updated`);
    expect(updated.status).toBe("active");
    expect(updated.currency).toBe("EUR");
    expect(updated.timezone).toBe("Europe/Amsterdam");
    expect(updated.codeConfig).toEqual({ prefix: "UPD", length: 12 });
    expect(updated.perUserRedemptionLimit).toBe(3);
    expect(updated.autoApply).toBe(false);
  });
});
