import { z } from "zod";

// JSON Logic rules are deeply recursive; the contract treats them as an
// opaque object validated only as "valid JSON". The rules engine performs
// runtime validation when evaluating.
export const segmentRule = z.record(z.string(), z.unknown());

export const segmentOutput = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  rule: segmentRule,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const segmentCreateInput = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  rule: segmentRule,
});

export const segmentUpdateInput = segmentCreateInput.partial();
