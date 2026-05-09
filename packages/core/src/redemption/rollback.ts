import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { emitEvent } from "../events/index.ts";
import type { RedeemResult, VoucherRow } from "./types.ts";

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
        externalOrderId: original.externalOrderId,
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

    await emitEvent(tx, {
      type: "voucher.redeemed.rolled_back",
      entityId: original.voucherId,
      payload: {
        rollbackRedemptionId: row.id,
        originalRedemptionId: original.id,
        voucherId: original.voucherId,
        amount: original.amount ?? 0,
      },
    });

    return {
      ok: true,
      redemptionId: row.id,
      amount: original.amount ?? 0,
      breakdown: [],
      finalOrder: { amount: 0, currency: "USD" },
    };
  });
}
