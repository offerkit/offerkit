import { z } from "zod";

export const referralReward = z.object({
  kind: z.enum(["discount", "gift_card", "loyalty_points", "custom"]),
  discount: z
    .object({
      type: z.enum(["AMOUNT", "PERCENTAGE"]),
      amount: z.number().int().min(0).optional(),
      percent: z.number().int().min(0).max(10000).optional(),
      maxDiscountAmount: z.number().int().min(0).optional(),
    })
    .optional(),
  creditCents: z.number().int().min(0).optional(),
  loyaltyProgramId: z.string().uuid().optional(),
  loyaltyPoints: z.number().int().min(0).optional(),
  typeKey: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const referralProgramOutput = z.object({
  id: z.string().uuid(),
  campaignId: z.string().uuid(),
  referrerReward: referralReward,
  refereeReward: referralReward,
  codeLength: z.number().int(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const referralProgramCreateInput = z.object({
  campaignId: z.string().uuid(),
  referrerReward: referralReward,
  refereeReward: referralReward,
  codeLength: z.number().int().min(4).max(32).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const referralProgramUpdateInput = referralProgramCreateInput
  .omit({ campaignId: true })
  .partial();

export const referralStatus = z.enum(["issued", "converted", "rejected"]);

export const referralOutput = z.object({
  id: z.string().uuid(),
  programId: z.string().uuid(),
  referrerCustomerId: z.string().uuid(),
  refereeCustomerId: z.string().uuid().nullable(),
  code: z.string(),
  status: referralStatus,
  convertedAt: z.string().datetime().nullable(),
  conversionEventId: z.string().nullable(),
  referrerRedemptionId: z.string().uuid().nullable(),
  refereeRedemptionId: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const referralIssueInput = z.object({
  programId: z.string().uuid(),
  referrerCustomerId: z.string().uuid(),
  prefix: z.string().min(1).max(12).optional(),
});

export const referralConvertInput = z.object({
  code: z.string().min(1),
  refereeCustomerId: z.string().uuid(),
  conversionEventId: z.string().optional(),
});

const referralIssued = z.object({
  kind: z.enum(["discount", "gift_card", "loyalty_points", "custom"]),
  voucherCode: z.string().optional(),
  loyaltyTransactionId: z.string().uuid().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const referralConvertOutput = z.object({
  ok: z.boolean(),
  referralId: z.string().uuid().optional(),
  referrerCustomerId: z.string().uuid().optional(),
  refereeCustomerId: z.string().uuid().optional(),
  referrerReward: referralIssued.optional(),
  refereeReward: referralIssued.optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});

export const referralIssueOutput = z.object({
  ok: z.boolean(),
  referralId: z.string().uuid().optional(),
  code: z.string().optional(),
  errorCode: z.string().optional(),
  message: z.string().optional(),
});
