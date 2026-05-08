import { z } from "zod";

// Accept either a number or a numeric string so REST query-string callers and
// typed RPC callers share the same contract. Coercion happens here, not in the
// route handlers.
const limit = z
  .union([z.number(), z.string().regex(/^\d+$/)])
  .transform((v) => (typeof v === "string" ? Number.parseInt(v, 10) : v))
  .pipe(z.number().int().min(1).max(100))
  .default(20);

export const paginationInput = z.object({
  cursor: z.string().optional(),
  limit,
});

export function paginatedOutput<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    next: z.string().optional(),
    prev: z.string().optional(),
  });
}
