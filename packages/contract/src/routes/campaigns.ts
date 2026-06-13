import { oc } from "@orpc/contract";
import { z } from "zod";
import { mcpMeta } from "../mcp.ts";
import {
  campaignCreateInput,
  campaignOutput,
  campaignUpdateInput,
} from "../schemas/campaign.ts";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";

export const campaigns = {
  list: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({ method: "GET", path: "/campaigns", summary: "List campaigns" })
    .input(paginationInput.extend({ search: z.string().optional() }))
    .output(paginatedOutput(campaignOutput)),
  get: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({
      method: "GET",
      path: "/campaigns/{id}",
      summary: "Get campaign",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(campaignOutput),
  create: oc
    .route({ method: "POST", path: "/campaigns", summary: "Create campaign" })
    .input(campaignCreateInput)
    .output(campaignOutput),
  update: oc
    .route({
      method: "PATCH",
      path: "/campaigns/{id}",
      summary: "Update campaign",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ patch: campaignUpdateInput }) }))
    .output(campaignOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/campaigns/{id}",
      summary: "Soft-delete campaign",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(z.object({ ok: z.literal(true) })),
};
