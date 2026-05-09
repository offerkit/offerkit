import { and, eq, isNull } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { withSpan } from "../observability/index.ts";
import { checkActivation, messageFor, previewDiscount, previewGiftCard } from "./shared.ts";
import type { ValidateInput, ValidateResult, VoucherRow } from "./types.ts";

export function validate(db: Db, input: ValidateInput): Promise<ValidateResult> {
  return withSpan(
    "voucher.validate",
    () => validateImpl(db, input),
    {
      "voucher.code": input.voucherCode,
      ...(input.customerId ? { "customer.id": input.customerId } : {}),
    },
  );
}

async function validateImpl(db: Db, input: ValidateInput): Promise<ValidateResult> {
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
