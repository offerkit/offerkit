import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { schema, type Db } from "@open-voucherify/db";
import { redeem } from "./index.ts";

// Concurrency test exercises the FOR UPDATE lock against a real Postgres.
// Skips gracefully without a DATABASE_URL so the default workspace test
// run (and lefthook) doesn't depend on infra. Set TEST_DATABASE_URL or
// DATABASE_URL to a throwaway db to enable.
const url = process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const enabled = Boolean(url);

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(here, "..", "..", "..", "db", "drizzle");

let pool: Pool | undefined;
let db: Db | undefined;

beforeAll(async () => {
  if (!enabled || !url) return;
  pool = new Pool({ connectionString: url });
  const migrator = drizzle(pool);
  await migrate(migrator, { migrationsFolder });
  db = drizzle(pool, { schema, casing: "snake_case" });
}, 30_000);

afterAll(async () => {
  await pool?.end();
});

describe.skipIf(!enabled)("redeem concurrency", () => {
  it("FOR UPDATE serializes concurrent redemptions of a limited voucher", async () => {
    if (!db) throw new Error("db not initialized");

    const code = `CONCUR-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    const [inserted] = await db
      .insert(schema.voucher)
      .values({
        code,
        type: "DISCOUNT",
        discount: { type: "AMOUNT", amount: 100 },
        redemptionLimit: 1,
        active: true,
      })
      .returning({ id: schema.voucher.id });
    if (!inserted) throw new Error("voucher insert failed");

    const N = 16;
    const results = await Promise.all(
      Array.from({ length: N }, () =>
        redeem(db!, {
          voucherCode: code,
          order: { amount: 5_000, currency: "USD" },
        }),
      ),
    );

    const successes = results.filter((r) => r.ok);
    const limitFailures = results.filter(
      (r) => !r.ok && r.code === "redemption_limit_reached",
    );

    expect(successes).toHaveLength(1);
    expect(limitFailures).toHaveLength(N - 1);

    const fresh = await db
      .select({ count: schema.voucher.redemptionCount })
      .from(schema.voucher)
      .where(eq(schema.voucher.id, inserted.id));
    expect(fresh[0]?.count).toBe(1);

    // Cleanup so reruns of the suite don't accumulate test data.
    await db.delete(schema.redemption).where(eq(schema.redemption.voucherId, inserted.id));
    await db.delete(schema.voucher).where(eq(schema.voucher.id, inserted.id));
  }, 30_000);
});
