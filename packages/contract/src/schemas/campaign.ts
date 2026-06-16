import { z } from "zod";

export const campaignType = z.enum([
  "DISCOUNT",
  "GIFT_VOUCHERS",
  "LOYALTY_PROGRAM",
  "REFERRAL_PROGRAM",
  "PROMOTION",
]);
export const campaignStatus = z.enum(["draft", "active", "paused", "ended"]);

export const codeConfig = z.object({
  length: z.number().int().min(4).max(32).optional(),
  prefix: z.string().max(20).optional(),
  suffix: z.string().max(20).optional(),
  charset: z.enum(["alphanumeric", "uppercase", "lowercase", "numeric"]).optional(),
  excludeConfusable: z.boolean().optional(),
});

export const campaignOutput = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  type: campaignType,
  status: campaignStatus,
  currency: z.string().length(3),
  timezone: z.string(),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  codeConfig,
  validationRuleId: z.string().uuid().nullable(),
  perUserRedemptionLimit: z.number().int().nullable(),
  autoApply: z.boolean(),
  voucherCount: z.number().int(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const campaignCreateInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: campaignType,
  currency: z.string().length(3),
  timezone: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  codeConfig: codeConfig.optional(),
  validationRuleId: z.string().uuid().nullable().optional(),
  perUserRedemptionLimit: z.number().int().min(1).optional(),
  autoApply: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const campaignUpdateInput = campaignCreateInput.omit({ type: true }).partial().extend({
  status: campaignStatus.optional(),
});
