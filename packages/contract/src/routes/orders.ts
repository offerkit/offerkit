import { oc } from "@orpc/contract";
import { z } from "zod";
import { paginatedOutput } from "../schemas/pagination.ts";
import {
  orderCreateInput,
  orderListInput,
  orderOutput,
  orderUpdateInput,
} from "../schemas/order.ts";

export const orders = {
  list: oc
    .route({ method: "GET", path: "/orders", summary: "List orders" })
    .input(orderListInput)
    .output(paginatedOutput(orderOutput)),
  get: oc
    .route({ method: "GET", path: "/orders/{id}", summary: "Fetch one order" })
    .input(z.object({ id: z.string().uuid() }))
    .output(orderOutput),
  create: oc
    .route({ method: "POST", path: "/orders", summary: "Create an order" })
    .input(orderCreateInput)
    .output(orderOutput),
  update: oc
    .route({ method: "PATCH", path: "/orders/{id}", summary: "Update an order" })
    .input(orderUpdateInput)
    .output(orderOutput),
  cancel: oc
    .route({ method: "POST", path: "/orders/{id}/cancel", summary: "Cancel an order" })
    .input(z.object({ id: z.string().uuid() }))
    .output(orderOutput),
  fulfill: oc
    .route({ method: "POST", path: "/orders/{id}/fulfill", summary: "Mark order fulfilled" })
    .input(z.object({ id: z.string().uuid() }))
    .output(orderOutput),
  delete: oc
    .route({ method: "DELETE", path: "/orders/{id}", summary: "Soft-delete an order" })
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) })),
  redemptions: oc
    .route({
      method: "GET",
      path: "/orders/{id}/redemptions",
      summary: "List redemptions attached to an order",
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(
      z.object({
        data: z.array(
          z.object({
            id: z.string().uuid(),
            voucherCode: z.string(),
            voucherId: z.string().uuid(),
            customerId: z.string().uuid().nullable(),
            result: z.enum(["SUCCESS", "FAILURE", "ROLLBACK"]),
            failureReason: z.string().nullable(),
            amount: z.number().int().nullable(),
            createdAt: z.string().datetime(),
          }),
        ),
      }),
    ),
};
