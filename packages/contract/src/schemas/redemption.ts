import { z } from "zod";
import { voucherDiscount } from "./voucher.ts";

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
  /** uuid of an `order` row created via the orders API. */
  orderId: z.string().uuid().optional(),
  /** Free-form integrator order reference (Shopify id, etc). */
  externalOrderId: z.string().min(1).max(120).optional(),
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export const breakdownEntry = z.object({
  voucherId: z.string().uuid(),
  code: z.string(),
  amount: z.number().int(),
  type: z.enum(["AMOUNT", "PERCENTAGE"]).optional(),
  reason: z.enum(["exclusivity_lost", "zero_after_running_total"]).optional(),
});

export const redemptionExplanation = z.object({
  code: z.enum([
    "voucher_not_found",
    "campaign_inactive",
    "voucher_disabled",
    "voucher_expired",
    "redemption_limit_reached",
    "per_user_redemption_limit_reached",
    "customer_required",
    "customer_mismatch",
    "validation_failed",
    "currency_mismatch",
    "gift_balance_zero",
    "no_discount_effect",
    "order_required",
    "exclusivity_lost",
    "zero_after_running_total",
    "gift_card_stacking_unsupported",
  ]),
  message: z.string(),
  voucherId: z.string().uuid().optional(),
  voucherCode: z.string().optional(),
  details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

export const validateOutput = z.object({
  valid: z.boolean(),
  code: z.string().optional(),
  message: z.string().optional(),
  explanations: z.array(redemptionExplanation).optional(),
  preview: z
    .object({
      amount: z.number().int(),
      finalOrder: z.object({ amount: z.number().int(), currency: z.string() }),
      breakdown: z.array(breakdownEntry),
    })
    .optional(),
});

export const qualifyInput = z.object({
  customerId: z.string().uuid(),
  order: orderInput,
  filters: z
    .object({
      campaignIds: z.array(z.string().uuid()).max(100).optional(),
      includeSkipped: z.boolean().optional(),
    })
    .optional(),
});

export const qualifyOutput = z.object({
  eligible: z.array(
    z.object({
      code: z.string(),
      campaignId: z.string().uuid().nullable(),
      discount: voucherDiscount
        .omit({ appliesTo: true })
        .nullable(),
      endDate: z.string().datetime().nullable(),
      preview: z
        .object({
          amount: z.number().int(),
          finalOrder: z.object({ amount: z.number().int(), currency: z.string() }),
          breakdown: z.array(breakdownEntry),
        })
        .optional(),
    }),
  ),
  skipped: z.array(
    z.object({
      code: z.string(),
      campaignId: z.string().uuid().nullable(),
      reason: z.string(),
      message: z.string(),
    }),
  ),
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
  explanations: z.array(redemptionExplanation).optional(),
});

export const stackRedeemInput = z.object({
  codes: z.array(z.string().min(1)).min(1).max(20),
  customerId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  externalOrderId: z.string().min(1).max(120).optional(),
  order: orderInput,
  idempotencyKey: z.string().min(1).max(128).optional(),
});

export const stackEntry = z.object({
  voucherCode: z.string(),
  voucherId: z.string().uuid(),
  redemptionId: z.string().uuid(),
  amount: z.number().int(),
});

export const stackRedeemOutput = z.object({
  ok: z.boolean(),
  batchId: z.string().uuid().optional(),
  amount: z.number().int().optional(),
  finalOrder: z.object({ amount: z.number().int(), currency: z.string() }).optional(),
  breakdown: z.array(breakdownEntry).optional(),
  entries: z.array(stackEntry).optional(),
  idempotent: z.boolean().optional(),
  code: z.string().optional(),
  message: z.string().optional(),
  explanations: z.array(redemptionExplanation).optional(),
});
