import { oc } from "@orpc/contract";
import { z } from "zod";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";
import {
  validationRuleCreateInput,
  validationRuleOutput,
  validationRuleUpdateInput,
} from "../schemas/validation-rule.ts";

export const validationRules = {
  list: oc
    .route({ method: "GET", path: "/validation-rules", summary: "List validation rules" })
    .input(paginationInput.extend({ search: z.string().optional() }))
    .output(paginatedOutput(validationRuleOutput)),
  get: oc
    .route({
      method: "GET",
      path: "/validation-rules/{id}",
      summary: "Get validation rule",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(validationRuleOutput),
  create: oc
    .route({ method: "POST", path: "/validation-rules", summary: "Create validation rule" })
    .input(validationRuleCreateInput)
    .output(validationRuleOutput),
  update: oc
    .route({
      method: "PATCH",
      path: "/validation-rules/{id}",
      summary: "Update validation rule",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ patch: validationRuleUpdateInput }) }))
    .output(validationRuleOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/validation-rules/{id}",
      summary: "Soft-delete validation rule",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(z.object({ ok: z.literal(true) })),
};
