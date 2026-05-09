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
let keyId: string | undefined;

beforeAll(async () => {
  if (!E2E_ENABLED || !TEST_DB_URL) return;
  ({ db } = await getTestDb(TEST_DB_URL));
  const minted = await mintTestKey(db);
  token = minted.token;
  prefix = minted.prefix;
  keyId = `key_${minted.prefix}`;
}, 30_000);

afterAll(async () => {
  if (db && prefix) await deleteTestKey(db, prefix);
});

describe.skipIf(!E2E_ENABLED)("audit log", () => {
  it("mutations across multiple domains are logged with the right actor + entity", async () => {
    if (!token || !keyId) throw new Error("setup failed");
    const client = makeClient(token);

    // Drive mutations across 3 domains.
    const camp = await client.campaigns.create({
      name: randomId("camp-aud"),
      type: "DISCOUNT",
      currency: "USD",
    });
    const cust = await client.customers.create({
      email: `${randomId("audc")}@example.com`,
    });
    const code = randomId("AUD").toUpperCase();
    await client.vouchers.create({
      code,
      campaignId: camp.id,
      type: "DISCOUNT",
      discount: { type: "AMOUNT", amount: 100 },
    });

    // writeAudit is fire-and-forget; poll briefly until our rows appear.
    let log!: Awaited<ReturnType<typeof client.auditLog.list>>;
    let ours: typeof log.data = [];
    for (let i = 0; i < 30; i++) {
      log = await client.auditLog.list({ actor: "api_key" });
      ours = log.data.filter((row) => row.actorId === keyId);
      if (ours.length >= 3) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    expect(ours.length).toBeGreaterThanOrEqual(3);

    const entities = new Set(ours.map((r) => r.entity));
    expect(entities.has("campaigns")).toBe(true);
    expect(entities.has("customers")).toBe(true);
    expect(entities.has("vouchers")).toBe(true);

    // entityId is recorded for the campaign create.
    const campaignAudit = ours.find(
      (r) => r.entity === "campaigns" && r.action === "create",
    );
    expect(campaignAudit?.entityId).toBe(camp.id);
    void cust;
  }, 15_000);
});
