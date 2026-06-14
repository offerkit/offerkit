import { calculateDiscount, type DiscountOrder, type DiscountResult } from "../discount/index.ts";
import { evaluateRule, type Rule, type RuleContext } from "../rules/index.ts";
import { failureExplanation } from "./explanations.ts";
import type {
  RedemptionCustomerRow,
  RedemptionCampaignRow,
  RedemptionFailureCode,
  RedemptionValidationRuleRow,
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

export function checkCampaignValidationRule(
  voucher: VoucherRow,
  campaign: RedemptionCampaignRow | null | undefined,
  validationRule: RedemptionValidationRuleRow | null | undefined,
  customer: RedemptionCustomerRow | null | undefined,
  order: DiscountOrder | undefined,
  now: Date,
): ValidateResult | null {
  if (!campaign?.validationRuleId) return null;

  const details = {
    campaignId: campaign.id,
    validationRuleId: campaign.validationRuleId,
  };
  if (!validationRule || validationRule.deletedAt) {
    return {
      valid: false,
      code: "validation_failed",
      message: "Voucher validation rule is unavailable",
      explanations: [
        failureExplanation("validation_failed", voucher, {
          ...details,
          ruleAvailable: false,
        }),
      ],
    };
  }

  const context: RuleContext = {
    customer: customer
      ? {
          id: customer.id,
          email: customer.email,
          name: customer.name,
          phone: customer.phone,
          address: customer.address ?? null,
          metadata: customer.metadata,
          summary: customer.summary,
        }
      : undefined,
    order: order ? { ...order, items: order.items ?? [] } : undefined,
    voucher: { id: voucher.id, code: voucher.code },
    now: now.toISOString(),
    metadata: {},
  };
  const result = evaluateRule(validationRule.rule as Rule, context);
  if (result.trace.error) {
    return {
      valid: false,
      code: "validation_failed",
      message: "Voucher validation rule could not be evaluated",
      explanations: [
        failureExplanation("validation_failed", voucher, {
          ...details,
          ruleError: result.trace.error,
        }),
      ],
    };
  }
  if (!result.passed) {
    return {
      valid: false,
      code: "validation_failed",
      message: messageFor("validation_failed"),
      explanations: [failureExplanation("validation_failed", voucher, details)],
    };
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

export function validateVoucher(
  voucher: VoucherRow | undefined,
  order: DiscountOrder | undefined,
  campaign?: RedemptionCampaignRow | null,
  options: {
    validationRule?: RedemptionValidationRuleRow | null;
    customer?: RedemptionCustomerRow | null;
    now?: Date;
  } = {},
): ValidateResult {
  if (!voucher) {
    return {
      valid: false,
      code: "voucher_not_found",
      message: "Voucher not found",
      explanations: [failureExplanation("voucher_not_found")],
    };
  }

  const now = options.now ?? new Date();
  const failure = checkActivation(voucher, now);
  if (failure) {
    return {
      valid: false,
      code: failure,
      message: messageFor(failure),
      explanations: [failureExplanation(failure, voucher)],
    };
  }

  const campaignFailure = checkCampaignActivation(campaign, order?.currency, now);
  if (campaignFailure) {
    return {
      valid: false,
      code: campaignFailure,
      message: messageFor(campaignFailure),
      explanations: [failureExplanation(campaignFailure, voucher)],
    };
  }

  const ruleFailure = checkCampaignValidationRule(
    voucher,
    campaign,
    options.validationRule,
    options.customer,
    order,
    now,
  );
  if (ruleFailure) return ruleFailure;

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
    case "validation_failed":
      return "Voucher validation rule did not match";
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
