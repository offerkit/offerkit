import { and, eq, isNull, sql } from "drizzle-orm";
import { schema, type Db } from "@open-voucherify/db";
import { calculateDiscount, type DiscountOrder, type DiscountResult } from "../discount/index.ts";
import { logger } from "../observability/index.ts";

const log = logger.child({ component: "redemption" });

export type RedemptionFailureCode =
  | "voucher_not_found"
  | "voucher_disabled"
  | "voucher_expired"
  | "redemption_limit_reached"
  | "currency_mismatch"
  | "gift_balance_zero"
  | "order_required";

export interface RedeemInput {
  voucherCode: string;
  customerId?: string;
  orderId?: string;
  order?: DiscountOrder;
  idempotencyKey?: string;
}

export interface RedeemSuccess {
  ok: true;
  redemptionId: string;
  amount: number;
  breakdown: DiscountResult["breakdown"];
  finalOrder: DiscountResult["finalOrder"];
  idempotent?: boolean;
}

export interface RedeemFailure {
  ok: false;
  code: RedemptionFailureCode;
  message: string;
}

export type RedeemResult = RedeemSuccess | RedeemFailure;

export interface ValidateInput {
  voucherCode: string;
  customerId?: string;
  order?: DiscountOrder;
}

export interface ValidateResult {
  valid: boolean;
  code?: RedemptionFailureCode;
  message?: string;
  preview?: { amount: number; finalOrder: DiscountResult["finalOrder"]; breakdown: DiscountResult["breakdown"] };
}

interface VoucherRow extends Record<string, unknown> {
  id: string;
  code: string;
  campaignId: string | null;
  type: string;
  discount: { type: "AMOUNT" | "PERCENTAGE"; amount?: number; percent?: number; maxDiscountAmount?: number } | null;
  giftBalance: number | null;
  redemptionLimit: number | null;
  redemptionCount: number;
  active: boolean;
  startDate: Date | null;
  endDate: Date | null;
  priority: number;
  exclusive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
}

function checkActivation(v: VoucherRow, now: Date): RedemptionFailureCode | null {
  if (!v.active) return "voucher_disabled";
  if (v.startDate && v.startDate > now) return "voucher_expired";
  if (v.endDate && v.endDate < now) return "voucher_expired";
  if (v.redemptionLimit != null && v.redemptionCount >= v.redemptionLimit) {
    return "redemption_limit_reached";
  }
  if (v.type === "GIFT_CARD" && (v.giftBalance ?? 0) <= 0) {
    return "gift_balance_zero";
  }
  return null;
}

interface GiftPreview {
  spend: number;
  remainingBalance: number;
  finalOrder: DiscountResult["finalOrder"];
  breakdown: DiscountResult["breakdown"];
}

function previewGiftCard(v: VoucherRow, order: DiscountOrder | undefined): GiftPreview | null {
  const balance = v.giftBalance ?? 0;
  if (!order) {
    return {
      spend: 0,
      remainingBalance: balance,
      finalOrder: { amount: 0, currency: "USD" },
      breakdown: [],
    };
  }
  const spend = Math.min(balance, order.amount);
  return {
    spend,
    remainingBalance: balance - spend,
    finalOrder: { amount: order.amount - spend, currency: order.currency },
    breakdown: [
      {
        voucherId: v.id,
        code: v.code,
        amount: spend,
        type: "AMOUNT",
      },
    ],
  };
}

function previewDiscount(v: VoucherRow, order: DiscountOrder | undefined): DiscountResult {
  if (!order) {
    return {
      appliedDiscounts: [],
      breakdown: [],
      finalOrder: { amount: 0, currency: "USD" },
    };
  }
  return calculateDiscount({
    order,
    vouchers: v.discount
      ? [
          {
            id: v.id,
            code: v.code,
            type: v.discount.type,
            amount: v.discount.amount,
            percent: v.discount.percent,
            maxDiscountAmount: v.discount.maxDiscountAmount,
            priority: v.priority,
            exclusive: v.exclusive,
            createdAt: v.createdAt.toISOString(),
          },
        ]
      : [],
  });
}

export async function validate(db: Db, input: ValidateInput): Promise<ValidateResult> {
  const row = (await db
    .select()
    .from(schema.voucher)
    .where(and(eq(schema.voucher.code, input.voucherCode), isNull(schema.voucher.deletedAt)))
    .limit(1)) as VoucherRow[];
  const voucher = row[0];
  if (!voucher) return { valid: false, code: "voucher_not_found", message: "Voucher not found" };

  const now = new Date();
  const failure = checkActivation(voucher, now);
  if (failure) {
    return { valid: false, code: failure, message: messageFor(failure) };
  }

  if (voucher.type === "GIFT_CARD") {
    const gp = previewGiftCard(voucher, input.order);
    if (!gp) return { valid: false, code: "gift_balance_zero", message: messageFor("gift_balance_zero") };
    return {
      valid: true,
      preview: { amount: gp.spend, finalOrder: gp.finalOrder, breakdown: gp.breakdown },
    };
  }

  const preview = previewDiscount(voucher, input.order);
  return {
    valid: true,
    preview: {
      amount: preview.appliedDiscounts.reduce((s, a) => s + a.amount, 0),
      finalOrder: preview.finalOrder,
      breakdown: preview.breakdown,
    },
  };
}

function messageFor(code: RedemptionFailureCode): string {
  switch (code) {
    case "voucher_not_found":
      return "Voucher not found";
    case "voucher_disabled":
      return "Voucher is disabled";
    case "voucher_expired":
      return "Voucher is outside its active window";
    case "redemption_limit_reached":
      return "Voucher has reached its redemption limit";
    case "currency_mismatch":
      return "Voucher currency does not match the order currency";
    case "gift_balance_zero":
      return "Gift card has no remaining balance";
    case "order_required":
      return "An order is required to redeem this voucher";
  }
}

export async function redeem(db: Db, input: RedeemInput): Promise<RedeemResult> {
  return db.transaction(async (tx) => {
    const locked = (await tx
      .select()
      .from(schema.voucher)
      .where(and(eq(schema.voucher.code, input.voucherCode), isNull(schema.voucher.deletedAt)))
      .limit(1)
      .for("update")) as VoucherRow[];
    const voucher = locked[0];
    if (!voucher) {
      return { ok: false, code: "voucher_not_found", message: messageFor("voucher_not_found") };
    }

    // Idempotency: replay prior response if (voucherId, idempotencyKey) hits.
    if (input.idempotencyKey) {
      const prior = await tx
        .select()
        .from(schema.redemption)
        .where(
          and(
            eq(schema.redemption.voucherId, voucher.id),
            eq(schema.redemption.idempotencyKey, input.idempotencyKey),
          ),
        )
        .limit(1);
      const existing = prior[0];
      if (existing) {
        log.info({ voucherCode: input.voucherCode, idempotent: true }, "replaying redemption");
        if (existing.result === "SUCCESS") {
          return {
            ok: true,
            redemptionId: existing.id,
            amount: existing.amount ?? 0,
            breakdown: (existing.breakdown as { breakdown?: DiscountResult["breakdown"] })?.breakdown ?? [],
            finalOrder: (existing.breakdown as { finalOrder?: DiscountResult["finalOrder"] })?.finalOrder ?? {
              amount: 0,
              currency: "USD",
            },
            idempotent: true,
          };
        }
        return {
          ok: false,
          code: (existing.failureReason as RedemptionFailureCode | null) ?? "voucher_disabled",
          message: messageFor((existing.failureReason as RedemptionFailureCode | null) ?? "voucher_disabled"),
        };
      }
    }

    const now = new Date();
    const failure = checkActivation(voucher, now);
    if (failure) {
      const [failRow] = await tx
        .insert(schema.redemption)
        .values({
          voucherId: voucher.id,
          customerId: input.customerId ?? null,
          orderId: input.orderId ?? null,
          result: "FAILURE",
          failureReason: failure,
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning({ id: schema.redemption.id });
      void failRow;
      return { ok: false, code: failure, message: messageFor(failure) };
    }

    if (voucher.type === "GIFT_CARD") {
      if (!input.order) {
        return { ok: false, code: "order_required", message: messageFor("order_required") };
      }
      const gp = previewGiftCard(voucher, input.order);
      if (!gp || gp.spend === 0) {
        return { ok: false, code: "gift_balance_zero", message: messageFor("gift_balance_zero") };
      }

      await tx
        .update(schema.voucher)
        .set({
          giftBalance: gp.remainingBalance,
          redemptionCount: voucher.redemptionCount + 1,
          updatedAt: now,
        })
        .where(eq(schema.voucher.id, voucher.id));

      const [redemptionRow] = await tx
        .insert(schema.redemption)
        .values({
          voucherId: voucher.id,
          customerId: input.customerId ?? null,
          orderId: input.orderId ?? null,
          result: "SUCCESS",
          amount: gp.spend,
          breakdown: { breakdown: gp.breakdown, finalOrder: gp.finalOrder },
          idempotencyKey: input.idempotencyKey ?? null,
        })
        .returning({ id: schema.redemption.id });
      if (!redemptionRow) throw new Error("redemption insert failed");

      await tx.insert(schema.giftCardTransaction).values({
        voucherId: voucher.id,
        redemptionId: redemptionRow.id,
        delta: -gp.spend,
        balanceAfter: gp.remainingBalance,
        reason: "REDEMPTION",
      });

      return {
        ok: true,
        redemptionId: redemptionRow.id,
        amount: gp.spend,
        breakdown: gp.breakdown,
        finalOrder: gp.finalOrder,
      };
    }

    const preview = previewDiscount(voucher, input.order);
    const amount = preview.appliedDiscounts.reduce((s, a) => s + a.amount, 0);

    await tx
      .update(schema.voucher)
      .set({ redemptionCount: voucher.redemptionCount + 1, updatedAt: now })
      .where(eq(schema.voucher.id, voucher.id));

    const [row] = await tx
      .insert(schema.redemption)
      .values({
        voucherId: voucher.id,
        customerId: input.customerId ?? null,
        orderId: input.orderId ?? null,
        result: "SUCCESS",
        amount,
        breakdown: { breakdown: preview.breakdown, finalOrder: preview.finalOrder },
        idempotencyKey: input.idempotencyKey ?? null,
      })
      .returning({ id: schema.redemption.id });
    if (!row) throw new Error("redemption insert failed");

    return {
      ok: true,
      redemptionId: row.id,
      amount,
      breakdown: preview.breakdown,
      finalOrder: preview.finalOrder,
    };
  });
}

export async function rollback(db: Db, redemptionId: string): Promise<RedeemResult> {
  return db.transaction(async (tx) => {
    const [original] = await tx
      .select()
      .from(schema.redemption)
      .where(eq(schema.redemption.id, redemptionId))
      .limit(1);
    if (!original) {
      return { ok: false, code: "voucher_not_found", message: "Redemption not found" };
    }
    if (original.result !== "SUCCESS") {
      return { ok: false, code: "voucher_disabled", message: "Only SUCCESS redemptions can be rolled back" };
    }

    const [voucherRow] = (await tx
      .select()
      .from(schema.voucher)
      .where(eq(schema.voucher.id, original.voucherId))
      .limit(1)
      .for("update")) as VoucherRow[];
    if (!voucherRow) throw new Error("voucher missing during rollback");

    const isGiftCard = voucherRow.type === "GIFT_CARD";
    const restoredBalance = isGiftCard
      ? (voucherRow.giftBalance ?? 0) + (original.amount ?? 0)
      : null;

    await tx
      .update(schema.voucher)
      .set({
        redemptionCount: sql`${schema.voucher.redemptionCount} - 1`,
        ...(isGiftCard ? { giftBalance: restoredBalance } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.voucher.id, original.voucherId));

    const [row] = await tx
      .insert(schema.redemption)
      .values({
        voucherId: original.voucherId,
        customerId: original.customerId,
        orderId: original.orderId,
        result: "ROLLBACK",
        amount: original.amount,
        parentRedemptionId: original.id,
      })
      .returning({ id: schema.redemption.id });
    if (!row) throw new Error("rollback insert failed");

    if (isGiftCard && original.amount && restoredBalance != null) {
      await tx.insert(schema.giftCardTransaction).values({
        voucherId: original.voucherId,
        redemptionId: row.id,
        delta: original.amount,
        balanceAfter: restoredBalance,
        reason: "ROLLBACK",
      });
    }

    return {
      ok: true,
      redemptionId: row.id,
      amount: original.amount ?? 0,
      breakdown: [],
      finalOrder: { amount: 0, currency: "USD" },
    };
  });
}
