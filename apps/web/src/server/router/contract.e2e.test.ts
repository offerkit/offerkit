import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { ZodSmartCoercionPlugin } from "@orpc/zod";
import { schema, type Db } from "@offerkit/db";
import { createClient } from "@offerkit/sdk";
import { mintApiKey } from "@/lib/api-key";
import { router } from "./index";

// SDK contract end-to-end test. Drives the typed @offerkit/sdk
// client against the live oRPC router via a fake fetch — no HTTP
// server needed, no Next.js boot. Skips without TEST_DATABASE_URL so
// the default workspace test run stays infra-free.
const url = process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const enabled = Boolean(url);

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(
  here,
  "..",
  "..",
  "..",
  "..",
  "..",
  "packages",
  "db",
  "drizzle",
);

let pool: Pool | undefined;
let db: Db | undefined;
let mintedToken: string | undefined;

beforeAll(async () => {
  if (!enabled || !url) return;
  process.env["BETTER_AUTH_SECRET"] ??= "test-secret-1234567890123456789012";
  process.env["DATABASE_URL"] = url;
  pool = new Pool({ connectionString: url });
  const migrator = drizzle(pool);
  await migrate(migrator, { migrationsFolder });
  db = drizzle(pool, { schema, casing: "snake_case" });

  const minted = mintApiKey();
  await db
    .insert(schema.apiKey)
    .values({
      id: `key_${minted.prefix}`,
      name: "e2e test",
      prefix: minted.prefix,
      hashedSecret: minted.hashedSecret,
      scopes: ["*"],
      rateLimitRps: 10_000,
    })
    .onConflictDoNothing();
  mintedToken = minted.token;
}, 30_000);

afterAll(async () => {
  if (db && mintedToken) {
    const prefix = mintedToken.split("_")[1];
    if (prefix) {
      await db.delete(schema.apiKey).where(eq(schema.apiKey.prefix, prefix));
    }
  }
  await pool?.end();
});

describe.skipIf(!enabled)("SDK contract e2e", () => {
  it("typed client mints a campaign + voucher and redeems it", async () => {
    if (!db || !mintedToken) throw new Error("setup failed");

    const handler = new OpenAPIHandler(router, {
      plugins: [new ZodSmartCoercionPlugin()],
    });

    // The SDK passes a Request object as `input` with body/method/headers
    // already attached; we forward it straight to the oRPC handler so
    // headers (notably Authorization) and the streamed body survive.
    const fakeFetch: typeof fetch = async (input, init) => {
      const req =
        input instanceof Request
          ? init
            ? new Request(input, init)
            : input
          : new Request(typeof input === "string" ? input : input.toString(), init);
      const { response } = await handler.handle(req, {
        prefix: "/api/v1",
        context: { request: req, headers: req.headers },
      });
      return response ?? new Response("not found", { status: 404 });
    };

    const client = createClient({
      baseUrl: "http://test.local",
      apiKey: mintedToken,
      fetch: fakeFetch,
    });

    const campaign = await client.campaigns.create({
      name: `e2e-${Date.now()}`,
      type: "DISCOUNT",
      currency: "USD",
    });
    await client.campaigns.update({
      params: { id: campaign.id },
      body: { patch: { status: "active" } },
    });
    expect(campaign.id).toMatch(/^[0-9a-f-]{36}$/);

    const bulk = await client.vouchers.bulk({
      campaignId: campaign.id,
      count: 1,
      discount: { type: "AMOUNT", amount: 500 },
    });
    expect(bulk.generated).toBe(1);

    const list = await client.vouchers.list({ campaignId: campaign.id, limit: 5 });
    const voucher = list.data[0];
    expect(voucher).toBeDefined();
    if (!voucher) return;

    const validated = await client.vouchers.validate({
      params: { code: voucher.code },
      body: { order: { amount: 5_000, currency: "USD" } },
    });
    expect(validated.valid).toBe(true);

    const redeemed = await client.vouchers.redeem({
      params: { code: voucher.code },
      body: { order: { amount: 5_000, currency: "USD" } },
    });
    expect(redeemed.ok).toBe(true);
    expect(redeemed.redemptionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(redeemed.amount).toBe(500);
  }, 30_000);
});
