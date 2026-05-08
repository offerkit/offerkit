import { z } from "zod";

export const customerAddress = z.object({
  line1: z.string().optional(),
  line2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().length(2).optional(),
});

export const customerSummary = z.object({
  totalSpent: z.number().int().nonnegative().optional(),
  redemptionCount: z.number().int().nonnegative().optional(),
  lastRedeemedAt: z.string().datetime().optional(),
});

export const customerOutput = z.object({
  id: z.string().uuid(),
  email: z.string().email().nullable(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  address: customerAddress.nullable(),
  metadata: z.record(z.string(), z.unknown()),
  summary: customerSummary,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const customerCreateInput = z.object({
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: customerAddress.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const customerUpdateInput = customerCreateInput.partial();
