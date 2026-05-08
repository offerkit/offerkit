import { z } from "zod";

export const loyaltyProgramOutput = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  pointsExpiryDays: z.number().int().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const loyaltyProgramCreateInput = z.object({
  campaignId: z.string().uuid(),
  pointsExpiryDays: z.number().int().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const loyaltyProgramUpdateInput = z
  .object({
    pointsExpiryDays: z.number().int().min(1).nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .partial();

export const loyaltyTierOutput = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  name: z.string(),
  threshold: z.number().int(),
  earnMultiplier: z.number().int(),
  sortOrder: z.number().int(),
});

export const loyaltyTierCreateInput = z.object({
  programId: z.string().uuid(),
  name: z.string().min(1).max(100),
  threshold: z.number().int().min(0),
  earnMultiplier: z.number().int().min(0).default(10000),
  sortOrder: z.number().int().default(0),
});

export const loyaltyTierUpdateInput = loyaltyTierCreateInput.omit({ programId: true }).partial();

export const loyaltyEarningRuleFormula = z.object({
  kind: z.enum(["fixed", "per_cents", "custom"]),
  value: z.number().int().min(0).optional(),
  divisor: z.number().int().min(1).optional(),
});

export const loyaltyEarningRuleOutput = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  name: z.string(),
  event: z.string(),
  validationRuleId: z.string().uuid().nullable(),
  formula: loyaltyEarningRuleFormula,
  active: z.enum(["yes", "no"]),
});

export const loyaltyEarningRuleCreateInput = z.object({
  programId: z.string().uuid(),
  name: z.string().min(1).max(100),
  event: z.string().min(1).max(100),
  validationRuleId: z.string().uuid().optional(),
  formula: loyaltyEarningRuleFormula,
  active: z.enum(["yes", "no"]).optional(),
});

export const loyaltyEarningRuleUpdateInput = loyaltyEarningRuleCreateInput
  .omit({ programId: true })
  .partial();

export const loyaltyRewardPayload = z.object({
  kind: z.enum(["discount", "gift_card", "custom"]),
  discount: z
    .object({
      type: z.enum(["AMOUNT", "PERCENTAGE"]),
      amount: z.number().int().min(0).optional(),
      percent: z.number().int().min(0).max(10000).optional(),
      maxDiscountAmount: z.number().int().min(0).optional(),
    })
    .optional(),
  creditCents: z.number().int().min(0).optional(),
  typeKey: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const loyaltyRewardOutput = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  cost: z.number().int(),
  payload: loyaltyRewardPayload,
});

export const loyaltyRewardCreateInput = z.object({
  programId: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  cost: z.number().int().min(1),
  payload: loyaltyRewardPayload,
});

export const loyaltyRewardUpdateInput = loyaltyRewardCreateInput.omit({ programId: true }).partial();

export const loyaltyMemberOutput = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  programId: z.string().uuid(),
  balance: z.number().int(),
  lifetimePoints: z.number().int(),
  currentTierId: z.string().uuid().nullable(),
  enrolledAt: z.string().datetime(),
});

export const loyaltyMemberEnrollInput = z.object({
  programId: z.string().uuid(),
  customerId: z.string().uuid(),
});

export const loyaltyEarnInput = z.object({
  memberId: z.string().uuid(),
  basePoints: z.number().int().min(1),
  earningRuleId: z.string().uuid().optional(),
  eventId: z.string().optional(),
  note: z.string().max(500).optional(),
  expiresAt: z.string().datetime().optional(),
  applyMultiplier: z.boolean().optional(),
});

export const loyaltyAdjustInput = z.object({
  memberId: z.string().uuid(),
  delta: z.number().int(),
  note: z.string().max(500).optional(),
});

export const loyaltyRedeemInput = z.object({
  memberId: z.string().uuid(),
  rewardId: z.string().uuid(),
  note: z.string().max(500).optional(),
});

export const loyaltyTransactionOutput = z.object({
  id: z.string().uuid(),
  memberId: z.string().uuid(),
  delta: z.number().int(),
  balanceAfter: z.number().int(),
  reason: z.enum(["EARN", "REDEEM", "ADJUSTMENT", "EXPIRY", "ROLLBACK"]),
  rewardId: z.string().uuid().nullable(),
  earningRuleId: z.string().uuid().nullable(),
  eventId: z.string().nullable(),
  note: z.string().nullable(),
  expiresAt: z.string().datetime().nullable(),
  expiredAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
