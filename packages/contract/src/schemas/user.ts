import { z } from "zod";

export const userRole = z.enum(["admin", "member"]);

export const userOutput = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: userRole,
  mustChangePassword: z.boolean(),
  disabledAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});

export const userCreateInput = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  role: userRole.default("member"),
});

export const userCreateOutput = userOutput.extend({
  /** Generated password. Shown once at creation. */
  password: z.string(),
});
