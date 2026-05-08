import { oc } from "@orpc/contract";
import { z } from "zod";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";
import {
  eventOutput,
  webhookCreateInput,
  webhookCreateOutput,
  webhookDeliveryOutput,
  webhookOutput,
  webhookUpdateInput,
} from "../schemas/webhook.ts";

export const webhooks = {
  list: oc
    .route({ method: "GET", path: "/webhooks", summary: "List webhooks" })
    .output(z.object({ data: z.array(webhookOutput) })),
  get: oc
    .route({ method: "GET", path: "/webhooks/{id}", summary: "Get webhook" })
    .input(z.object({ id: z.string().uuid() }))
    .output(webhookOutput),
  create: oc
    .route({ method: "POST", path: "/webhooks", summary: "Create webhook" })
    .input(webhookCreateInput)
    .output(webhookCreateOutput),
  update: oc
    .route({ method: "PATCH", path: "/webhooks/{id}", summary: "Update webhook" })
    .input(z.object({ id: z.string().uuid(), patch: webhookUpdateInput }))
    .output(webhookOutput),
  delete: oc
    .route({ method: "DELETE", path: "/webhooks/{id}", summary: "Soft-delete webhook" })
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) })),
  deliveries: oc
    .route({
      method: "GET",
      path: "/webhooks/{id}/deliveries",
      summary: "Recent deliveries for a webhook",
    })
    .input(z.object({ id: z.string().uuid(), limit: z.number().int().min(1).max(100).default(50) }))
    .output(z.object({ data: z.array(webhookDeliveryOutput) })),
  replay: oc
    .route({
      method: "POST",
      path: "/webhooks/deliveries/{id}/replay",
      summary: "Re-enqueue a delivery (succeeded or otherwise)",
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) })),
};

export const events = {
  list: oc
    .route({ method: "GET", path: "/events", summary: "List events" })
    .input(paginationInput.extend({ type: z.string().optional() }))
    .output(paginatedOutput(eventOutput)),
  get: oc
    .route({ method: "GET", path: "/events/{id}", summary: "Get event" })
    .input(z.object({ id: z.string().uuid() }))
    .output(eventOutput),
};
