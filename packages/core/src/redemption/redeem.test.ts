import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { redeem, rollback } from "./index.ts";
import { getTestDb } from "./_test-db.ts";

// Live-DB redemption suite. Skips without TEST_DATABASE_URL so the
// default workspace test run stays infra-free. Set
// TEST_DATABASE_URL=postgres://... to enable.
const url = process.env["TEST_DATABASE_URL"] ?? process.env["DATABASE_URL"];
const enabled = Boolean(url);

let db: Db | undefined;
let close: (() => Promise<void>) | undefined;

beforeAll(async () => {
  if (!enabled || !url) return;
  const handle = await getTestDb(url);
  db = handle.db;
  close = handle.close;
}, 30_000);

afterAll(async () => {
  await close?.();
});

async function makeVoucher(
  d: Db,
  overrides: Partial<typeof schema.voucher.$inferInsert> = {},
): Promise<{ id: string; code: string }> {
  const code = `T-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const [row] = await d
    .insert(schema.voucher)
    .values({
      code,
      type: "DISCOUNT",
      discount: { type: "AMOUNT", amount: 500 },
      active: true,
      ...overrides,
    })
    .returning({ id: schema.voucher.id });
  if (!row) throw new Error("voucher insert failed");
  return { id: row.id, code };
}

async function cleanup(d: Db, voucherId: string): Promise<void> {
  await d.delete(schema.giftCardTransaction).where(eq(schema.giftCardTransaction.voucherId, voucherId));
  await d.delete(schema.redemption).where(eq(schema.redemption.voucherId, voucherId));
  await d.delete(schema.voucher).where(eq(schema.voucher.id, voucherId));
}

describe.skipIf(!enabled)("redeem (live DB)", () => {
  it("replays the same response for repeated idempotency keys", async () => {
    if (!db) throw new Error("db not initialized");
    const v = await makeVoucher(db);
    const key = `idem-${Date.now()}`;
    const first = await redeem(db, {
      voucherCode: v.code,
      idempotencyKey: key,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(first.ok).toBe(true);
    const second = await redeem(db, {
      voucherCode: v.code,
      idempotencyKey: key,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.idempotent).toBe(true);
      expect(second.redemptionId).toBe(first.redemptionId);
    }
    const fresh = await db
      .select({ count: schema.voucher.redemptionCount })
      .from(schema.voucher)
      .where(eq(schema.voucher.id, v.id));
    expect(fresh[0]?.count).toBe(1);
    await cleanup(db, v.id);
  });

  it("refuses redemption for a disabled voucher", async () => {
    if (!db) throw new Error("db not initialized");
    const v = await makeVoucher(db, { active: false });
    const r = await redeem(db, { voucherCode: v.code, order: { amount: 5_000, currency: "USD" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("voucher_disabled");
    await cleanup(db, v.id);
  });

  it("refuses redemption outside the activation window", async () => {
    if (!db) throw new Error("db not initialized");
    const past = new Date(Date.now() - 24 * 60 * 60_000);
    const v = await makeVoucher(db, { startDate: past, endDate: past });
    const r = await redeem(db, { voucherCode: v.code, order: { amount: 5_000, currency: "USD" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("voucher_expired");
    await cleanup(db, v.id);
  });

  it("rollback restores redemptionCount and writes a ROLLBACK row", async () => {
    if (!db) throw new Error("db not initialized");
    const v = await makeVoucher(db, { redemptionLimit: 5 });
    const r = await redeem(db, { voucherCode: v.code, order: { amount: 5_000, currency: "USD" } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const rb = await rollback(db, r.redemptionId);
    expect(rb.ok).toBe(true);
    const after = await db
      .select({ count: schema.voucher.redemptionCount })
      .from(schema.voucher)
      .where(eq(schema.voucher.id, v.id));
    expect(after[0]?.count).toBe(0);
    const rollbackRows = await db
      .select({ result: schema.redemption.result })
      .from(schema.redemption)
      .where(eq(schema.redemption.voucherId, v.id));
    expect(rollbackRows.some((row) => row.result === "ROLLBACK")).toBe(true);
    await cleanup(db, v.id);
  });

  it("gift card draws against balance and refuses when zeroed", async () => {
    if (!db) throw new Error("db not initialized");
    const v = await makeVoucher(db, {
      type: "GIFT_CARD",
      discount: null,
      giftBalance: 1_000,
    });

    const partial = await redeem(db, {
      voucherCode: v.code,
      order: { amount: 600, currency: "USD" },
    });
    expect(partial.ok).toBe(true);
    if (partial.ok) expect(partial.amount).toBe(600);

    const drained = await redeem(db, {
      voucherCode: v.code,
      order: { amount: 1_000, currency: "USD" },
    });
    expect(drained.ok).toBe(true);
    if (drained.ok) expect(drained.amount).toBe(400);

    const empty = await redeem(db, {
      voucherCode: v.code,
      order: { amount: 100, currency: "USD" },
    });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.code).toBe("gift_balance_zero");

    await cleanup(db, v.id);
  });
});
