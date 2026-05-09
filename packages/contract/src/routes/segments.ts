import { oc } from "@orpc/contract";
import { z } from "zod";
import { mcpMeta } from "../mcp.ts";
import { customerOutput } from "../schemas/customer.ts";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";
import {
  segmentCreateInput,
  segmentOutput,
  segmentRule,
  segmentUpdateInput,
} from "../schemas/segment.ts";

export const segments = {
  list: oc
    .route({ method: "GET", path: "/segments", summary: "List segments" })
    .input(paginationInput.extend({ search: z.string().optional() }))
    .output(paginatedOutput(segmentOutput)),
  get: oc
    .route({ method: "GET", path: "/segments/{id}", summary: "Get segment" })
    .input(z.object({ id: z.string().uuid() }))
    .output(segmentOutput),
  create: oc
    .route({ method: "POST", path: "/segments", summary: "Create segment" })
    .input(segmentCreateInput)
    .output(segmentOutput),
  update: oc
    .route({ method: "PATCH", path: "/segments/{id}", summary: "Update segment" })
    .input(z.object({ id: z.string().uuid(), patch: segmentUpdateInput }))
    .output(segmentOutput),
  delete: oc
    .route({ method: "DELETE", path: "/segments/{id}", summary: "Soft-delete segment" })
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) })),
  preview: oc
    .meta(
      mcpMeta({
        expose: true,
        riskLevel: "safe",
        description:
          "Run a JSON Logic rule against existing customers and report match count plus a sample.",
      }),
    )
    .route({ method: "POST", path: "/segments/preview", summary: "Preview rule against customers" })
    .input(z.object({ rule: segmentRule, sampleSize: z.number().int().min(1).max(50).default(10) }))
    .output(
      z.object({
        matchedCount: z.number().int().nonnegative(),
        sample: z.array(customerOutput),
      }),
    ),
};
