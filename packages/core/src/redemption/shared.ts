import { and, eq, sql } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
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

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

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

export function checkCustomerBinding(
  v: VoucherRow,
  campaign: RedemptionCampaignRow | null | undefined,
  customerId: string | undefined,
): RedemptionFailureCode | null {
  if (v.customerId && !customerId) return "customer_required";
  if (v.customerId && customerId !== v.customerId) return "customer_mismatch";
  if (
    (v.perUserRedemptionLimit != null || campaign?.perUserRedemptionLimit != null) &&
    !customerId
  ) {
    return "customer_required";
  }
  return null;
}

export async function checkPerUserRedemptionLimit(
  db: Db | Tx,
  v: VoucherRow,
  campaign: RedemptionCampaignRow | null | undefined,
  customerId: string | undefined,
): Promise<{
  code: RedemptionFailureCode;
  details?: Record<string, string | number | boolean | null>;
} | null> {
  if (v.perUserRedemptionLimit == null && campaign?.perUserRedemptionLimit == null) return null;
  if (!customerId) return { code: "customer_required" };

  if (v.perUserRedemptionLimit != null) {
    const count = await countNetSuccessfulRedemptions(
      db,
      customerId,
      eq(schema.redemption.voucherId, v.id),
    );
    if (count >= v.perUserRedemptionLimit) {
      return { code: "per_user_redemption_limit_reached" };
    }
  }

  if (campaign?.perUserRedemptionLimit != null) {
    const count = await countNetSuccessfulRedemptions(
      db,
      customerId,
      sql`${schema.redemption.voucherId} IN (
        SELECT "id" FROM "voucher" WHERE "campaign_id" = ${campaign.id}
      )`,
    );
    if (count >= campaign.perUserRedemptionLimit) {
      return {
        code: "per_user_redemption_limit_reached",
        details: {
          campaignId: campaign.id,
          perUserRedemptionLimit: campaign.perUserRedemptionLimit,
        },
      };
    }
  }

  return null;
}

async function countNetSuccessfulRedemptions(
  db: Db | Tx,
  customerId: string,
  scope: ReturnType<typeof eq> | ReturnType<typeof sql>,
): Promise<number> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
    })
    .from(schema.redemption)
    .where(
      and(
        scope,
        eq(schema.redemption.customerId, customerId),
        eq(schema.redemption.result, "SUCCESS"),
        sql`NOT EXISTS (
          SELECT 1 FROM "redemption" AS rollback
          WHERE rollback."parent_redemption_id" = ${schema.redemption.id}
            AND rollback."result" = 'ROLLBACK'
        )`,
      ),
    );

  return row?.count ?? 0;
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

export async function validateVoucher(
  voucher: VoucherRow | undefined,
  order: DiscountOrder | undefined,
  campaign?: RedemptionCampaignRow | null,
  options: {
    db?: Db | Tx;
    validationRule?: RedemptionValidationRuleRow | null;
    customer?: RedemptionCustomerRow | null;
    customerId?: string;
    now?: Date;
  } = {},
): Promise<ValidateResult> {
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

  const customerFailure = checkCustomerBinding(voucher, campaign, options.customerId);
  if (customerFailure) {
    return {
      valid: false,
      code: customerFailure,
      message: messageFor(customerFailure),
      explanations: [failureExplanation(customerFailure, voucher)],
    };
  }
  const customerLimitFailure = options.db
    ? await checkPerUserRedemptionLimit(options.db, voucher, campaign, options.customerId)
    : null;
  if (customerLimitFailure) {
    return {
      valid: false,
      code: customerLimitFailure.code,
      message: messageFor(customerLimitFailure.code),
      explanations: [
        failureExplanation(customerLimitFailure.code, voucher, customerLimitFailure.details),
      ],
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
    case "per_user_redemption_limit_reached":
      return "Customer has reached this voucher's redemption limit";
    case "customer_required":
      return "A customer is required to use this voucher";
    case "customer_mismatch":
      return "Voucher is assigned to a different customer";
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
