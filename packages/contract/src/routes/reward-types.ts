import { oc } from "@orpc/contract";
import { z } from "zod";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";
import {
  rewardTypeCreateInput,
  rewardTypeOutput,
  rewardTypeUpdateInput,
} from "../schemas/reward-type.ts";

export const rewardTypes = {
  list: oc
    .route({ method: "GET", path: "/reward-types", summary: "List reward types" })
    .input(paginationInput.extend({ search: z.string().optional() }))
    .output(paginatedOutput(rewardTypeOutput)),
  get: oc
    .route({ method: "GET", path: "/reward-types/{id}", summary: "Get reward type" })
    .input(z.object({ id: z.string().uuid() }))
    .output(rewardTypeOutput),
  create: oc
    .route({ method: "POST", path: "/reward-types", summary: "Create reward type" })
    .input(rewardTypeCreateInput)
    .output(rewardTypeOutput),
  update: oc
    .route({ method: "PATCH", path: "/reward-types/{id}", summary: "Update reward type" })
    .input(z.object({ id: z.string().uuid(), patch: rewardTypeUpdateInput }))
    .output(rewardTypeOutput),
  delete: oc
    .route({ method: "DELETE", path: "/reward-types/{id}", summary: "Soft-delete reward type" })
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) })),
};
