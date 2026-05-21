import { oc } from "@orpc/contract";
import { z } from "zod";
import { mcpMeta } from "../mcp.ts";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";
import {
  qualificationInput,
  qualificationOutput,
  promotionTierCreateInput,
  promotionTierOutput,
  promotionTierUpdateInput,
} from "../schemas/promotion.ts";

export const promotions = {
  tiers: {
    list: oc
      .route({ method: "GET", path: "/promotions/tiers", summary: "List promotion tiers" })
      .input(
        paginationInput.extend({
          campaignId: z.string().uuid().optional(),
          active: z.boolean().optional(),
        }),
      )
      .output(paginatedOutput(promotionTierOutput)),
    create: oc
      .route({ method: "POST", path: "/promotions/tiers", summary: "Create promotion tier" })
      .input(promotionTierCreateInput)
      .output(promotionTierOutput),
    update: oc
      .route({ method: "PATCH", path: "/promotions/tiers/{id}", summary: "Update promotion tier" })
      .input(z.object({ id: z.string().uuid(), patch: promotionTierUpdateInput }))
      .output(promotionTierOutput),
    delete: oc
      .route({ method: "DELETE", path: "/promotions/tiers/{id}", summary: "Soft-delete promotion tier" })
      .input(z.object({ id: z.string().uuid() }))
      .output(z.object({ ok: z.literal(true) })),
  },
  qualify: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({
      method: "POST",
      path: "/promotions/qualify",
      summary: "Return auto-applied promotions a cart qualifies for",
    })
    .input(qualificationInput)
    .output(qualificationOutput),
};
