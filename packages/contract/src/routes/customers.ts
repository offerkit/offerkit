import { oc } from "@orpc/contract";
import { z } from "zod";
import {
  customerCreateInput,
  customerOutput,
  customerUpdateInput,
} from "../schemas/customer.ts";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";

export const customers = {
  list: oc
    .route({ method: "GET", path: "/customers", summary: "List customers" })
    .input(paginationInput.extend({ search: z.string().optional() }))
    .output(paginatedOutput(customerOutput)),
  get: oc
    .route({ method: "GET", path: "/customers/{id}", summary: "Get customer" })
    .input(z.object({ id: z.string().uuid() }))
    .output(customerOutput),
  create: oc
    .route({ method: "POST", path: "/customers", summary: "Create customer" })
    .input(customerCreateInput)
    .output(customerOutput),
  update: oc
    .route({ method: "PATCH", path: "/customers/{id}", summary: "Update customer" })
    .input(z.object({ id: z.string().uuid(), patch: customerUpdateInput }))
    .output(customerOutput),
  delete: oc
    .route({ method: "DELETE", path: "/customers/{id}", summary: "Soft-delete customer" })
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) })),
};
