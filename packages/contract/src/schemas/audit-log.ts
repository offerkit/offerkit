import { z } from "zod";

export const auditActor = z.enum(["user", "api_key", "system"]);

export const auditLogOutput = z.object({
  id: z.string().uuid(),
  actor: auditActor,
  actorId: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  before: z.unknown().nullable(),
  after: z.unknown().nullable(),
  ip: z.string().nullable(),
  userAgent: z.string().nullable(),
  createdAt: z.string().datetime(),
});

export const auditLogListInput = z.object({
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
  actor: auditActor.optional(),
  entity: z.string().optional(),
  action: z.string().optional(),
  entityId: z.string().optional(),
});
