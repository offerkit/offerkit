import { z } from "zod";
import { orderInput, breakdownEntry } from "./redemption.ts";
import { customReward, voucherDiscount } from "./voucher.ts";

export const promotionTierOutput = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  effect: voucherDiscount,
  customRewards: z.array(customReward),
  validationRuleId: z.string().uuid().nullable(),
  active: z.boolean(),
  priority: z.number().int(),
  exclusive: z.boolean(),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const promotionTierCreateInput = z.object({
  campaignId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  effect: voucherDiscount,
  customRewards: z.array(customReward).optional(),
  validationRuleId: z.string().uuid().optional(),
  active: z.boolean().optional(),
  priority: z.number().int().optional(),
  exclusive: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const promotionTierUpdateInput = promotionTierCreateInput.omit({ campaignId: true }).partial();

export const qualificationInput = z.object({
  customerId: z.string().uuid().optional(),
  order: orderInput,
  metadata: z.record(z.string(), z.unknown()).optional(),
  filters: z
    .object({
      campaignIds: z.array(z.string().uuid()).optional(),
      includeSkipped: z.boolean().optional(),
    })
    .optional(),
});

export const qualificationReason = z.enum([
  "campaign_inactive",
  "campaign_not_active",
  "promotion_inactive",
  "promotion_not_active",
  "currency_mismatch",
  "rule_failed",
  "rule_error",
  "no_discount_effect",
  "exclusivity_lost",
  "zero_after_running_total",
]);

export const qualifiedPromotion = z.object({
  source: z.literal("promotion"),
  campaignId: z.string().uuid(),
  promotionTierId: z.string().uuid(),
  name: z.string(),
  discount: voucherDiscount,
  customRewards: z.array(customReward),
  priority: z.number().int(),
  exclusive: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
});

export const skippedPromotion = qualifiedPromotion.extend({
  reason: qualificationReason,
  message: z.string(),
  trace: z.unknown().optional(),
});

export const qualificationOutput = z.object({
  eligible: z.array(qualifiedPromotion),
  skipped: z.array(skippedPromotion),
  preview: z.object({
    amount: z.number().int(),
    finalOrder: z.object({ amount: z.number().int(), currency: z.string() }),
    breakdown: z.array(breakdownEntry),
  }),
});
