import { z } from "zod";

export const orderItem = z.object({
  productId: z.string(),
  collectionId: z.string().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().int().min(0),
});

export const orderInput = z.object({
  amount: z.number().int().min(0),
  currency: z.string().length(3),
  items: z.array(orderItem).optional(),
});

export const validateInput = z.object({
  code: z.string().min(1),
  customerId: z.string().uuid().optional(),
  order: orderInput.optional(),
});

export const redeemInput = validateInput.extend({
  orderId: z.string().optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export const breakdownEntry = z.object({
  voucherId: z.string().uuid(),
  code: z.string(),
  amount: z.number().int(),
  type: z.enum(["AMOUNT", "PERCENTAGE"]).optional(),
  reason: z.enum(["exclusivity_lost", "zero_after_running_total"]).optional(),
});

export const validateOutput = z.object({
  valid: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  preview: z
    .object({
      amount: z.number().int(),
      finalOrder: z.object({ amount: z.number().int(), currency: z.string() }),
      breakdown: z.array(breakdownEntry),
    })
    .optional(),
});

export const redeemOutput = z.object({
  ok: z.boolean(),
  redemptionId: z.string().uuid().optional(),
  amount: z.number().int().optional(),
  finalOrder: z.object({ amount: z.number().int(), currency: z.string() }).optional(),
  breakdown: z.array(breakdownEntry).optional(),
  idempotent: z.boolean().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
});
