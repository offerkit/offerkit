import { calculateDiscount, type DiscountOrder, type DiscountResult } from "../discount/index.ts";
import { failureExplanation } from "./explanations.ts";
import type {
  RedemptionCampaignRow,
  RedemptionFailureCode,
  ValidateResult,
  VoucherRow,
} from "./types.ts";

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

export function checkCampaignActivation(
  campaign: RedemptionCampaignRow | null | undefined,
  orderCurrency: string | undefined,
  now: Date,
): RedemptionFailureCode | null {
  if (!campaign) return null;
  if (campaign.deletedAt || campaign.status !== "active") return "campaign_inactive";
  if (campaign.startDate && campaign.startDate > now) return "campaign_inactive";
  if (campaign.endDate && campaign.endDate < now) return "campaign_inactive";
  if (orderCurrency && campaign.currency !== orderCurrency) return "currency_mismatch";
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

export function validateVoucher(
  voucher: VoucherRow | undefined,
  order: DiscountOrder | undefined,
  campaign?: RedemptionCampaignRow | null,
): ValidateResult {
  if (!voucher) {
    return {
      valid: false,
      code: "voucher_not_found",
      message: "Voucher not found",
      explanations: [failureExplanation("voucher_not_found")],
    };
  }

  const failure = checkActivation(voucher, new Date());
  if (failure) {
    return {
      valid: false,
      code: failure,
      message: messageFor(failure),
      explanations: [failureExplanation(failure, voucher)],
    };
  }

  const campaignFailure = checkCampaignActivation(campaign, order?.currency, new Date());
  if (campaignFailure) {
    return {
      valid: false,
      code: campaignFailure,
      message: messageFor(campaignFailure),
      explanations: [failureExplanation(campaignFailure, voucher)],
    };
  }

  if (voucher.type === "GIFT_CARD") {
    const gp = previewGiftCard(voucher, order);
    if (!gp) {
      return {
        valid: false,
        code: "gift_balance_zero",
        message: messageFor("gift_balance_zero"),
        explanations: [failureExplanation("gift_balance_zero", voucher)],
      };
    }
    return {
      valid: true,
      preview: { amount: gp.spend, finalOrder: gp.finalOrder, breakdown: gp.breakdown },
    };
  }

  const preview = previewDiscount(voucher, order);
  const amount = preview.appliedDiscounts.reduce((s, a) => s + a.amount, 0);
  if (order && amount <= 0 && (voucher.customRewards?.length ?? 0) === 0) {
    return {
      valid: false,
      code: "no_discount_effect",
      message: messageFor("no_discount_effect"),
      explanations: [failureExplanation("no_discount_effect", voucher)],
    };
  }
  return {
    valid: true,
    preview: {
      amount,
      finalOrder: preview.finalOrder,
      breakdown: preview.breakdown,
    },
  };
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
    case "campaign_inactive":
      return "Campaign is not active";
    case "no_discount_effect":
      return "Voucher does not discount this order";
    case "order_required":
      return "An order is required to redeem this voucher";
  }
}
