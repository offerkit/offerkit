import { calculateDiscount, type DiscountOrder, type DiscountResult } from "../discount/index.ts";
import type { RedemptionFailureCode, VoucherRow } from "./types.ts";

export function checkActivation(v: VoucherRow, now: Date): RedemptionFailureCode | null {
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

export interface GiftPreview {
  spend: number;
  remainingBalance: number;
  finalOrder: DiscountResult["finalOrder"];
  breakdown: DiscountResult["breakdown"];
}

export function previewGiftCard(
  v: VoucherRow,
  order: DiscountOrder | undefined,
): GiftPreview | null {
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

export function previewDiscount(
  v: VoucherRow,
  order: DiscountOrder | undefined,
): DiscountResult {
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

export function messageFor(code: RedemptionFailureCode): string {
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
