import { oc } from "@orpc/contract";
import { z } from "zod";
import { mcpMeta } from "../mcp.ts";
import {
  customerCreateInput,
  customerOutput,
  customerUpdateInput,
  customerUpsertInput,
  customerUpsertOutput,
} from "../schemas/customer.ts";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";

export const customers = {
  list: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({ method: "GET", path: "/customers", summary: "List customers" })
    .input(paginationInput.extend({ search: z.string().optional() }))
    .output(paginatedOutput(customerOutput)),
  get: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({
      method: "GET",
      path: "/customers/{id}",
      summary: "Get customer",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(customerOutput),
  getByExternalId: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({
      method: "GET",
      path: "/customers/by-external-id/{externalId}",
      summary: "Get a customer by integrator-supplied externalId",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ externalId: z.string().min(1).max(256) }) }))
    .output(customerOutput),
  create: oc
    .route({ method: "POST", path: "/customers", summary: "Create customer" })
    .input(customerCreateInput)
    .output(customerOutput),
  upsert: oc
    .route({
      method: "PUT",
      path: "/customers/by-external-id",
      summary: "Create or update a customer keyed by externalId (idempotent)",
    })
    .input(customerUpsertInput)
    .output(customerUpsertOutput),
  update: oc
    .route({
      method: "PATCH",
      path: "/customers/{id}",
      summary: "Update customer",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ patch: customerUpdateInput }) }))
    .output(customerOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/customers/{id}",
      summary: "Soft-delete customer",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(z.object({ ok: z.literal(true) })),
};
