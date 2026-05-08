import { z } from "zod";

export const apiKeyOutput = z.object({
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  rateLimitRps: z.number().int(),
  lastUsedAt: z.string().datetime().nullable(),
  disabledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const apiKeyCreateInput = z.object({
  name: z.string().min(1).max(100),
  scopes: z.array(z.string()).optional(),
  rateLimitRps: z.number().int().min(1).max(10_000).optional(),
});

export const apiKeyCreateOutput = apiKeyOutput.extend({
  /** The plaintext token. Shown once at creation; never returned again. */
  token: z.string(),
});
