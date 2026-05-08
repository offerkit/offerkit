import { z } from "zod";

export const webhookOutput = z.object({
  id: z.string().uuid(),
  name: z.string(),
  url: z.string().url(),
  secretPrefix: z.string(),
  events: z.array(z.string()),
  active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const webhookCreateInput = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  events: z.array(z.string()).min(1).default(["*"]),
  active: z.boolean().default(true),
});

export const webhookCreateOutput = webhookOutput.extend({
  /** Plaintext signing secret. Shown once. */
  secret: z.string(),
});

export const webhookUpdateInput = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  events: z.array(z.string()).optional(),
  active: z.boolean().optional(),
});

export const webhookDeliveryOutput = z.object({
  id: z.string().uuid(),
  webhookId: z.string().uuid(),
  eventId: z.string().uuid(),
  eventType: z.string(),
  status: z.enum(["pending", "succeeded", "failed", "dead"]),
  attempts: z.number().int(),
  responseStatus: z.number().int().nullable(),
  responseBody: z.string().nullable(),
  error: z.string().nullable(),
  nextRetryAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const eventOutput = z.object({
  id: z.string().uuid(),
  type: z.string(),
  payload: z.record(z.string(), z.unknown()),
  entityId: z.string().nullable(),
  createdAt: z.string().datetime(),
});
