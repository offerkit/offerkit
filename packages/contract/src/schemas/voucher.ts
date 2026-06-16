import { z } from "zod";

export const voucherType = z.enum(["DISCOUNT", "GIFT_CARD"]);

export const voucherDiscount = z.object({
  type: z.enum(["AMOUNT", "PERCENTAGE"]),
  amount: z.number().int().min(0).optional(),
  percent: z.number().int().min(0).max(10000).optional(),
  maxDiscountAmount: z.number().int().min(0).optional(),
  appliesTo: z
    .object({
      productIds: z.array(z.string()).optional(),
      collectionIds: z.array(z.string()).optional(),
    })
    .optional(),
});

export const customReward = z.object({
  typeKey: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
});

export const voucherOutput = z.object({
  id: z.string().uuid(),
  code: z.string(),
  campaignId: z.string().uuid().nullable(),
  type: voucherType,
  discount: voucherDiscount.nullable(),
  customRewards: z.array(customReward),
  giftBalance: z.number().int().nullable(),
  redemptionLimit: z.number().int().nullable(),
  perUserRedemptionLimit: z.number().int().nullable(),
  redemptionCount: z.number().int(),
  priority: z.number().int(),
  exclusive: z.boolean(),
  active: z.boolean(),
  startDate: z.string().datetime().nullable(),
  endDate: z.string().datetime().nullable(),
  customerId: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const voucherCreateInput = z.object({
  code: z.string().min(1).optional(),
  campaignId: z.string().uuid().optional(),
  type: voucherType,
  discount: voucherDiscount.optional(),
  customRewards: z.array(customReward).optional(),
  giftBalance: z.number().int().min(0).optional(),
  redemptionLimit: z.number().int().min(1).optional(),
  perUserRedemptionLimit: z.number().int().min(1).optional(),
  priority: z.number().int().optional(),
  exclusive: z.boolean().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  customerId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const voucherUpdateInput = voucherCreateInput.omit({ type: true, code: true }).partial().extend({
  active: z.boolean().optional(),
});

export const voucherBulkCreateInput = z.object({
  campaignId: z.string().uuid(),
  count: z.number().int().min(1).max(100_000),
  discount: voucherDiscount.optional(),
  giftBalance: z.number().int().min(1).optional(),
});
