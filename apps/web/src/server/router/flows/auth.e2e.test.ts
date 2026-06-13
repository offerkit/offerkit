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
const cleanupPrefixes: string[] = [];

beforeAll(async () => {
  if (!E2E_ENABLED || !TEST_DB_URL) return;
  ({ db } = await getTestDb(TEST_DB_URL));
}, 30_000);

afterAll(async () => {
  const handle = db;
  if (!handle) return;
  await Promise.all(cleanupPrefixes.map((p) => deleteTestKey(handle, p)));
});

describe.skipIf(!E2E_ENABLED)("auth + scopes + rate limit", () => {
  it("mint + revoke: revoked key returns 401 on subsequent calls", async () => {
    if (!db) throw new Error("db not initialized");
    const admin = await mintTestKey(db);
    cleanupPrefixes.push(admin.prefix);
    const adminClient = makeClient(admin.token);

    // Mint a fresh key via the SDK (not via the test-key helper)
    const minted = await adminClient.apiKeys.create({
      name: `e2e-${randomId("k")}`,
      scopes: ["*"],
    });
    expect(minted.token).toMatch(/^offerkit_[A-Za-z0-9]{12}_[A-Za-z0-9]{40}$/);
    cleanupPrefixes.push(minted.prefix);

    const ephemeralClient = makeClient(minted.token);
    const list = await ephemeralClient.campaigns.list({ limit: 5 });
    expect(Array.isArray(list.data)).toBe(true);

    await adminClient.apiKeys.revoke({ params: { id: minted.id } });

    await expect(
      ephemeralClient.campaigns.list({ limit: 5 }),
    ).rejects.toThrow(/sign in required|unauthorized/i);
  });

  it("scope-limited key: vouchers:read can list but not redeem", async () => {
    if (!db) throw new Error("db not initialized");
    const readOnly = await mintTestKey(db, ["vouchers:read", "campaigns:write"]);
    cleanupPrefixes.push(readOnly.prefix);
    const client = makeClient(readOnly.token);

    // Read-side works for the scoped entity.
    const list = await client.vouchers.list({ limit: 1 });
    expect(Array.isArray(list.data)).toBe(true);

    // Write-side on vouchers must fail.
    await expect(
      client.vouchers.redeem({
        params: { code: "DOES-NOT-EXIST" },
        body: { order: { amount: 100, currency: "USD" } },
      }),
    ).rejects.toThrow(/missing required scope/i);
  });

  it("rate-limited key: rps=1 returns 429 on the second call within 1s", async () => {
    if (!db) throw new Error("db not initialized");
    const limited = await mintTestKey(db, ["*"], 1);
    cleanupPrefixes.push(limited.prefix);
    const client = makeClient(limited.token);

    // First call burns the bucket.
    await client.campaigns.list({ limit: 1 });
    // Second call within the same second must trip the limit.
    await expect(client.campaigns.list({ limit: 1 })).rejects.toThrow(
      /rate limit/i,
    );
  });
});
