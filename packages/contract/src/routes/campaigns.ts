import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  campaignCreateInput,
  campaignOutput,
  campaignUpdateInput,
} from "../schemas/campaign.ts";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";

export const campaigns = {
  list: oc
    .route({ method: "GET", path: "/campaigns", summary: "List campaigns" })
    .input(paginationInput.extend({ search: z.string().optional() }))
    .output(paginatedOutput(campaignOutput)),
  get: oc
    .route({ method: "GET", path: "/campaigns/{id}", summary: "Get campaign" })
    .input(z.object({ id: z.string().uuid() }))
    .output(campaignOutput),
  create: oc
    .route({ method: "POST", path: "/campaigns", summary: "Create campaign" })
    .input(campaignCreateInput)
    .output(campaignOutput),
  update: oc
    .route({ method: "PATCH", path: "/campaigns/{id}", summary: "Update campaign" })
    .input(z.object({ id: z.string().uuid(), patch: campaignUpdateInput }))
    .output(campaignOutput),
  delete: oc
    .route({ method: "DELETE", path: "/campaigns/{id}", summary: "Soft-delete campaign" })
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) })),
};
