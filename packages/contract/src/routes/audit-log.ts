import { oc } from "@orpc/contract";
import { auditLogListInput, auditLogOutput } from "../schemas/audit-log.ts";
import { z } from "zod";

export const auditLog = {
  list: oc
    .route({ method: "GET", path: "/audit-log", summary: "List audit log entries (admin)" })
    .input(auditLogListInput)
    .output(z.object({ data: z.array(auditLogOutput), next: z.string().optional() })),
};
