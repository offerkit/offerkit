import { and, eq, isNull } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import type { DiscountResult } from "../discount/index.ts";
import { emitEvent } from "../events/index.ts";
import { failureExplanation } from "./explanations.ts";
import { logger, withSpan } from "../observability/index.ts";
import { checkActivation, messageFor, previewDiscount, previewGiftCard } from "./shared.ts";
import type {
  RedeemInput,
  RedeemResult,
  RedemptionFailureCode,
  VoucherRow,
} from "./types.ts";

const log = logger.child({ component: "redemption" });

export function redeem(db: Db, input: RedeemInput): Promise<RedeemResult> {
  return withSpan(
    "voucher.redeem",
    () => redeemImpl(db, input),
    {
      "voucher.code": input.voucherCode,
      ...(input.customerId ? { "customer.id": input.customerId } : {}),
      ...(input.idempotencyKey ? { "redemption.idempotency_key": input.idempotencyKey } : {}),
    },
  );
}

function redeemImpl(db: Db, input: RedeemInput): Promise<RedeemResult> {
  return db.transaction(async (tx) => {
    const locked = (await tx
      .select()
      .from(schema.voucher)
      .where(and(eq(schema.voucher.code, input.voucherCode), isNull(schema.voucher.deletedAt)))
      .limit(1)
      .for("update")) as VoucherRow[];
    const voucher = locked[0];
    if (!voucher) {
      return {
        ok: false,
        code: "voucher_not_found",
        message: messageFor("voucher_not_found"),
        explanations: [failureExplanation("voucher_not_found")],
      };
    }

    if (input.idempotencyKey) {
      const replay = await replayRedemption(tx, voucher.id, input.idempotencyKey);
      if (replay) return replay;
    }

    const now = new Date();
    const failure = checkActivation(voucher, now);
    if (failure) {
      await tx.insert(schema.redemption).values({
        voucherId: voucher.id,
        customerId: input.customerId ?? null,
        orderId: input.orderId ?? null,
        externalOrderId: input.externalOrderId ?? null,
        result: "FAILURE",
        failureReason: failure,
        idempotencyKey: input.idempotencyKey ?? null,
      });
      return {
        ok: false,
        code: failure,
        message: messageFor(failure),
        explanations: [failureExplanation(failure, voucher)],
      };
    }

    if (voucher.type === "GIFT_CARD") {
      return redeemGiftCard(tx, voucher, input, now);
    }

    return redeemDiscount(tx, voucher, input, now);
  });
}

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function replayRedemption(
  tx: Tx,
  voucherId: string,
  idempotencyKey: string,
): Promise<RedeemResult | null> {
  const prior = await tx
    .select()
    .from(schema.redemption)
    .where(
      and(
        eq(schema.redemption.voucherId, voucherId),
        eq(schema.redemption.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);
  const existing = prior[0];
  if (!existing) return null;

  log.info({ voucherId, idempotent: true }, "replaying redemption");
  if (existing.result === "SUCCESS") {
    return {
      ok: true,
      redemptionId: existing.id,
      amount: existing.amount ?? 0,
      breakdown:
        (existing.breakdown as { breakdown?: DiscountResult["breakdown"] })?.breakdown ?? [],
      finalOrder:
        (existing.breakdown as { finalOrder?: DiscountResult["finalOrder"] })?.finalOrder ?? {
          amount: 0,
          currency: "USD",
        },
      idempotent: true,
    };
  }
  const code = (existing.failureReason as RedemptionFailureCode | null) ?? "voucher_disabled";
  return { ok: false, code, message: messageFor(code), explanations: [failureExplanation(code)] };
}

async function redeemGiftCard(
  tx: Tx,
  voucher: VoucherRow,
  input: RedeemInput,
  now: Date,
): Promise<RedeemResult> {
  if (!input.order) {
    return {
      ok: false,
      code: "order_required",
      message: messageFor("order_required"),
      explanations: [failureExplanation("order_required", voucher)],
    };
  }
  const gp = previewGiftCard(voucher, input.order);
  if (!gp || gp.spend === 0) {
    return {
      ok: false,
      code: "gift_balance_zero",
      message: messageFor("gift_balance_zero"),
      explanations: [failureExplanation("gift_balance_zero", voucher)],
    };
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
      externalOrderId: input.externalOrderId ?? null,
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

async function redeemDiscount(
  tx: Tx,
  voucher: VoucherRow,
  input: RedeemInput,
  now: Date,
): Promise<RedeemResult> {
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
      externalOrderId: input.externalOrderId ?? null,
      result: "SUCCESS",
      amount,
      breakdown: { breakdown: preview.breakdown, finalOrder: preview.finalOrder },
      idempotencyKey: input.idempotencyKey ?? null,
    })
    .returning({ id: schema.redemption.id });
  if (!row) throw new Error("redemption insert failed");

  await emitEvent(tx, {
    type: "voucher.redeemed",
    entityId: voucher.id,
    payload: {
      redemptionId: row.id,
      voucherId: voucher.id,
      voucherCode: voucher.code,
      customerId: input.customerId ?? null,
      orderId: input.orderId ?? null,
      externalOrderId: input.externalOrderId ?? null,
      amount,
      finalOrder: preview.finalOrder,
    },
  });

  return {
    ok: true,
    redemptionId: row.id,
    amount,
    breakdown: preview.breakdown,
    finalOrder: preview.finalOrder,
  };
}
