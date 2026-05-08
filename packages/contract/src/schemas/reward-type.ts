import { z } from "zod";

export const rewardTypeOutput = z.object({
  id: z.string().uuid(),
  key: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  payloadSchema: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const rewardTypeCreateInput = z.object({
  key: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[A-Z][A-Z0-9_]*$/, "Use SCREAMING_SNAKE_CASE: e.g. FREE_SHIPPING"),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  payloadSchema: z.record(z.string(), z.unknown()),
});

export const rewardTypeUpdateInput = rewardTypeCreateInput.omit({ key: true }).partial();
