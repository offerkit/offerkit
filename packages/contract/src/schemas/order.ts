import { z } from "zod";

export const orderStatus = z.enum(["CREATED", "PAID", "CANCELED", "FULFILLED"]);

export const orderItem = z.object({
  productId: z.string().optional(),
  sku: z.string().optional(),
  name: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
});

export const orderOutput = z.object({
  id: z.string().uuid(),
  externalId: z.string().nullable(),
  customerId: z.string().uuid().nullable(),
  items: z.array(orderItem),
  amount: z.number().int(),
  discountAmount: z.number().int(),
  currency: z.string(),
  status: orderStatus,
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const orderCreateInput = z.object({
  externalId: z.string().min(1).max(120).optional(),
  customerId: z.string().uuid().optional(),
  items: z.array(orderItem).min(1),
  amount: z.number().int().nonnegative(),
  discountAmount: z.number().int().nonnegative().optional(),
  currency: z.string().length(3),
  status: orderStatus.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const orderUpdateInput = z.object({
  id: z.string().uuid(),
  patch: z.object({
    status: orderStatus.optional(),
    discountAmount: z.number().int().nonnegative().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  }),
});

export const orderListInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
  customerId: z.string().uuid().optional(),
  status: orderStatus.optional(),
  search: z.string().optional(),
});
