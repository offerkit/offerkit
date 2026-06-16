import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { qualify, redeem, rollback, validate } from "./index.ts";
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

  it("refuses redemption for vouchers attached to inactive campaigns", async () => {
    if (!db) throw new Error("db not initialized");
    const [campaign] = await db
      .insert(schema.campaign)
      .values({ name: "Draft redemption campaign", type: "DISCOUNT", status: "draft", currency: "USD" })
      .returning({ id: schema.campaign.id });
    if (!campaign) throw new Error("campaign insert failed");

    const v = await makeVoucher(db, { campaignId: campaign.id });
    const r = await redeem(db, { voucherCode: v.code, order: { amount: 5_000, currency: "USD" } });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("campaign_inactive");

    await cleanup(db, v.id);
    await db.delete(schema.campaign).where(eq(schema.campaign.id, campaign.id));
  });

  it("refuses redemption when a discount has no effect", async () => {
    if (!db) throw new Error("db not initialized");
    const v = await makeVoucher(db, { discount: { type: "AMOUNT", amount: 0 } });
    const r = await redeem(db, { voucherCode: v.code, order: { amount: 5_000, currency: "USD" } });

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("no_discount_effect");

    await cleanup(db, v.id);
  });

  it("refuses redemption when the campaign validation rule does not match", async () => {
    if (!db) throw new Error("db not initialized");
    const [rule] = await db
      .insert(schema.validationRule)
      .values({
        name: "High minimum order",
        rule: { ">=": [{ var: "order.amount" }, 10_000] },
        appliesTo: "voucher",
      })
      .returning({ id: schema.validationRule.id });
    const [campaign] = await db
      .insert(schema.campaign)
      .values({
        name: "Rule gated redemption campaign",
        type: "DISCOUNT",
        status: "active",
        currency: "USD",
        validationRuleId: rule?.id,
      })
      .returning({ id: schema.campaign.id });
    if (!rule || !campaign) throw new Error("campaign rule fixture insert failed");

    const v = await makeVoucher(db, { campaignId: campaign.id });
    const validation = await validate(db, {
      voucherCode: v.code,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(validation.valid).toBe(false);
    expect(validation.code).toBe("validation_failed");

    const r = await redeem(db, {
      voucherCode: v.code,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("validation_failed");

    const fresh = await db
      .select({ count: schema.voucher.redemptionCount })
      .from(schema.voucher)
      .where(eq(schema.voucher.id, v.id));
    expect(fresh[0]?.count).toBe(0);

    await cleanup(db, v.id);
    await db.delete(schema.campaign).where(eq(schema.campaign.id, campaign.id));
    await db.delete(schema.validationRule).where(eq(schema.validationRule.id, rule.id));
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

  it("requires the matching customer for customer-bound vouchers", async () => {
    if (!db) throw new Error("db not initialized");
    const [owner] = await db.insert(schema.customer).values({}).returning({ id: schema.customer.id });
    const [other] = await db.insert(schema.customer).values({}).returning({ id: schema.customer.id });
    if (!owner || !other) throw new Error("customer insert failed");

    const v = await makeVoucher(db, {
      customerId: owner.id,
      redemptionLimit: 1,
    });

    const missingCustomer = await validate(db, {
      voucherCode: v.code,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(missingCustomer.valid).toBe(false);
    expect(missingCustomer.code).toBe("customer_required");

    const wrongCustomer = await redeem(db, {
      voucherCode: v.code,
      customerId: other.id,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(wrongCustomer.ok).toBe(false);
    if (!wrongCustomer.ok) expect(wrongCustomer.code).toBe("customer_mismatch");

    const ownerRedemption = await redeem(db, {
      voucherCode: v.code,
      customerId: owner.id,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(ownerRedemption.ok).toBe(true);

    await cleanup(db, v.id);
    await db.delete(schema.customer).where(eq(schema.customer.id, owner.id));
    await db.delete(schema.customer).where(eq(schema.customer.id, other.id));
  });

  it("limits public vouchers to one redemption per customer without a global cap", async () => {
    if (!db) throw new Error("db not initialized");
    const [customerA] = await db.insert(schema.customer).values({}).returning({ id: schema.customer.id });
    const [customerB] = await db.insert(schema.customer).values({}).returning({ id: schema.customer.id });
    if (!customerA || !customerB) throw new Error("customer insert failed");

    const v = await makeVoucher(db, {
      redemptionLimit: null,
      perUserRedemptionLimit: 1,
    });

    const firstA = await redeem(db, {
      voucherCode: v.code,
      customerId: customerA.id,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(firstA.ok).toBe(true);

    const secondA = await redeem(db, {
      voucherCode: v.code,
      customerId: customerA.id,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(secondA.ok).toBe(false);
    if (!secondA.ok) expect(secondA.code).toBe("per_user_redemption_limit_reached");

    const firstB = await redeem(db, {
      voucherCode: v.code,
      customerId: customerB.id,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(firstB.ok).toBe(true);

    const fresh = await db
      .select({ count: schema.voucher.redemptionCount })
      .from(schema.voucher)
      .where(eq(schema.voucher.id, v.id));
    expect(fresh[0]?.count).toBe(2);

    await cleanup(db, v.id);
    await db.delete(schema.customer).where(eq(schema.customer.id, customerA.id));
    await db.delete(schema.customer).where(eq(schema.customer.id, customerB.id));
  });

  it("limits campaign voucher redemptions to one per customer", async () => {
    if (!db) throw new Error("db not initialized");
    const [customerA] = await db.insert(schema.customer).values({}).returning({ id: schema.customer.id });
    const [customerB] = await db.insert(schema.customer).values({}).returning({ id: schema.customer.id });
    const [campaign] = await db
      .insert(schema.campaign)
      .values({
        name: "Per-user campaign cap",
        type: "DISCOUNT",
        status: "active",
        currency: "USD",
        perUserRedemptionLimit: 1,
      })
      .returning({ id: schema.campaign.id });
    if (!customerA || !customerB || !campaign) throw new Error("campaign fixture insert failed");

    const voucherA = await makeVoucher(db, { campaignId: campaign.id });
    const voucherB = await makeVoucher(db, { campaignId: campaign.id });

    const firstA = await redeem(db, {
      voucherCode: voucherA.code,
      customerId: customerA.id,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(firstA.ok).toBe(true);

    const secondA = await redeem(db, {
      voucherCode: voucherB.code,
      customerId: customerA.id,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(secondA.ok).toBe(false);
    if (!secondA.ok) expect(secondA.code).toBe("per_user_redemption_limit_reached");

    const firstB = await redeem(db, {
      voucherCode: voucherB.code,
      customerId: customerB.id,
      order: { amount: 5_000, currency: "USD" },
    });
    expect(firstB.ok).toBe(true);

    await cleanup(db, voucherA.id);
    await cleanup(db, voucherB.id);
    await db.delete(schema.campaign).where(eq(schema.campaign.id, campaign.id));
    await db.delete(schema.customer).where(eq(schema.customer.id, customerA.id));
    await db.delete(schema.customer).where(eq(schema.customer.id, customerB.id));
  });

  it("qualifies customer-held vouchers without writing redemption rows", async () => {
    if (!db) throw new Error("db not initialized");
    const [customer] = await db.insert(schema.customer).values({}).returning({ id: schema.customer.id });
    const [otherCustomer] = await db.insert(schema.customer).values({}).returning({ id: schema.customer.id });
    const [campaign] = await db
      .insert(schema.campaign)
      .values({ name: "Qualified campaign", type: "DISCOUNT", status: "active", currency: "USD" })
      .returning({ id: schema.campaign.id });
    const [otherCampaign] = await db
      .insert(schema.campaign)
      .values({ name: "Other campaign", type: "DISCOUNT", status: "active", currency: "USD" })
      .returning({ id: schema.campaign.id });
    if (!customer || !otherCustomer || !campaign || !otherCampaign) {
      throw new Error("qualification fixture insert failed");
    }

    const valid = await makeVoucher(db, { customerId: customer.id, campaignId: campaign.id });
    const disabled = await makeVoucher(db, {
      customerId: customer.id,
      campaignId: campaign.id,
      active: false,
    });
    const wrongCampaign = await makeVoucher(db, {
      customerId: customer.id,
      campaignId: otherCampaign.id,
    });
    const wrongCustomer = await makeVoucher(db, {
      customerId: otherCustomer.id,
      campaignId: campaign.id,
    });

    const result = await qualify(db, {
      customerId: customer.id,
      order: { amount: 5_000, currency: "USD" },
      filters: { campaignIds: [campaign.id], includeSkipped: true },
    });

    expect(result.eligible.map((v) => v.code)).toEqual([valid.code]);
    expect(result.skipped).toMatchObject([
      { code: disabled.code, reason: "voucher_disabled", message: "Voucher is disabled" },
    ]);

    const redemptionRows = await db
      .select({ id: schema.redemption.id })
      .from(schema.redemption)
      .where(eq(schema.redemption.voucherId, valid.id));
    const disabledRedemptionRows = await db
      .select({ id: schema.redemption.id })
      .from(schema.redemption)
      .where(eq(schema.redemption.voucherId, disabled.id));
    expect(redemptionRows).toHaveLength(0);
    expect(disabledRedemptionRows).toHaveLength(0);

    await cleanup(db, valid.id);
    await cleanup(db, disabled.id);
    await cleanup(db, wrongCampaign.id);
    await cleanup(db, wrongCustomer.id);
    await db.delete(schema.campaign).where(eq(schema.campaign.id, campaign.id));
    await db.delete(schema.campaign).where(eq(schema.campaign.id, otherCampaign.id));
    await db.delete(schema.customer).where(eq(schema.customer.id, customer.id));
    await db.delete(schema.customer).where(eq(schema.customer.id, otherCustomer.id));
  });
});
