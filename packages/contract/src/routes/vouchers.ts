import { oc } from "@orpc/contract";
import { z } from "zod";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";
import {
  voucherBulkCreateInput,
  voucherCreateInput,
  voucherOutput,
  voucherUpdateInput,
} from "../schemas/voucher.ts";
import {
  redeemInput,
  redeemOutput,
  validateInput,
  validateOutput,
} from "../schemas/redemption.ts";

export const vouchers = {
  list: oc
    .route({ method: "GET", path: "/vouchers", summary: "List vouchers" })
    .input(
      paginationInput.extend({
        search: z.string().optional(),
        campaignId: z.string().uuid().optional(),
        active: z.boolean().optional(),
        customerId: z.string().uuid().optional(),
      }),
    )
    .output(paginatedOutput(voucherOutput)),
  get: oc
    .route({ method: "GET", path: "/vouchers/{code}", summary: "Get voucher by code" })
    .input(z.object({ code: z.string() }))
    .output(voucherOutput),
  create: oc
    .route({ method: "POST", path: "/vouchers", summary: "Create voucher" })
    .input(voucherCreateInput)
    .output(voucherOutput),
  update: oc
    .route({ method: "PATCH", path: "/vouchers/{code}", summary: "Update voucher" })
    .input(z.object({ code: z.string(), patch: voucherUpdateInput }))
    .output(voucherOutput),
  delete: oc
    .route({ method: "DELETE", path: "/vouchers/{code}", summary: "Soft-delete voucher" })
    .input(z.object({ code: z.string() }))
    .output(z.object({ ok: z.literal(true) })),
  bulk: oc
    .route({ method: "POST", path: "/vouchers/bulk", summary: "Generate vouchers in bulk" })
    .input(voucherBulkCreateInput)
    .output(z.object({ campaignId: z.string().uuid(), generated: z.number().int() })),

  // Hot path
  validate: oc
    .route({
      method: "POST",
      path: "/vouchers/{code}/validate",
      summary: "Validate a voucher against an optional order context",
    })
    .input(validateInput)
    .output(validateOutput),
  redeem: oc
    .route({
      method: "POST",
      path: "/vouchers/{code}/redemption",
      summary: "Redeem a voucher",
    })
    .input(redeemInput)
    .output(redeemOutput),
};
