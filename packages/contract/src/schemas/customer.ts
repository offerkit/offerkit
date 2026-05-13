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
  externalId: z.string().nullable(),
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
  externalId: z.string().min(1).max(256).optional(),
  address: customerAddress.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const customerUpdateInput = customerCreateInput.partial();

// Idempotent on externalId. If a live customer exists with this externalId,
// fields are updated in place (omitted fields are left untouched). Otherwise
// a new customer is created. `created` tells the caller which path was taken
// so they can fire a "new customer" event downstream if needed.
export const customerUpsertInput = z.object({
  externalId: z.string().min(1).max(256),
  email: z.string().email().optional(),
  name: z.string().optional(),
  phone: z.string().optional(),
  address: customerAddress.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const customerUpsertOutput = z.object({
  customer: customerOutput,
  created: z.boolean(),
});
