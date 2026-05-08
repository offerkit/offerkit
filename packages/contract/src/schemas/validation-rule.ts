import { z } from "zod";

export const validationRuleAppliesTo = z.enum(["voucher", "promotion", "earn", "reward"]);

export const validationRuleOutput = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  rule: z.record(z.string(), z.unknown()),
  appliesTo: validationRuleAppliesTo,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const validationRuleCreateInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rule: z.record(z.string(), z.unknown()),
  appliesTo: validationRuleAppliesTo.optional(),
});

export const validationRuleUpdateInput = validationRuleCreateInput.partial();
