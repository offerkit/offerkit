import { oc } from "@orpc/contract";
import { z } from "zod";
import { mcpMeta } from "../mcp.ts";
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
  qualifyInput,
  qualifyOutput,
  stackRedeemInput,
  stackRedeemOutput,
  validateInput,
  validateOutput,
} from "../schemas/redemption.ts";

export const vouchers = {
  list: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
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
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({
      method: "GET",
      path: "/vouchers/{code}",
      summary: "Get voucher by code",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ code: z.string() }) }))
    .output(voucherOutput),
  create: oc
    .route({ method: "POST", path: "/vouchers", summary: "Create voucher" })
    .input(voucherCreateInput)
    .output(voucherOutput),
  update: oc
    .route({
      method: "PATCH",
      path: "/vouchers/{code}",
      summary: "Update voucher",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ code: z.string() }), body: z.object({ patch: voucherUpdateInput }) }))
    .output(voucherOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/vouchers/{code}",
      summary: "Soft-delete voucher",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ code: z.string() }) }))
    .output(z.object({ ok: z.literal(true) })),
  bulk: oc
    .route({ method: "POST", path: "/vouchers/bulk", summary: "Generate vouchers in bulk" })
    .input(voucherBulkCreateInput)
    .output(
      z.object({
        campaignId: z.string().uuid(),
        // Number generated synchronously; 0 when the work was queued.
        generated: z.number().int(),
        // Set when count exceeds the inline threshold and the job is queued.
        jobId: z.string().uuid().optional(),
      }),
    ),

  // Hot path
  validate: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({
      method: "POST",
      path: "/vouchers/{code}/validate",
      summary: "Validate a voucher against an optional order context",
      inputStructure: "detailed",
    })
    .input(
      z.object({
        params: z.object({ code: z.string().min(1) }),
        body: validateInput.omit({ code: true }).optional(),
      }),
    )
    .output(validateOutput),
  qualify: oc
    .meta(mcpMeta({ expose: true, riskLevel: "safe" }))
    .route({
      method: "POST",
      path: "/vouchers/qualify",
      summary: "Batch-qualify customer-held voucher codes for an order",
    })
    .input(qualifyInput)
    .output(qualifyOutput),
  redeem: oc
    .meta(
      mcpMeta({
        expose: true,
        riskLevel: "mutating",
        description:
          "Commit a redemption against an order. Confirm with the user before calling. Use idempotencyKey to safely retry.",
      }),
    )
    .route({
      method: "POST",
      path: "/vouchers/{code}/redemption",
      summary: "Redeem a voucher",
      inputStructure: "detailed",
    })
    .input(
      z.object({
        params: z.object({ code: z.string().min(1) }),
        body: redeemInput.omit({ code: true }).optional(),
      }),
    )
    .output(redeemOutput),

  stackRedeem: oc
    .meta(
      mcpMeta({
        expose: true,
        riskLevel: "mutating",
        description:
          "Apply N codes to one order atomically. Either every voucher commits or none. Confirm with the user before calling.",
      }),
    )
    .route({
      method: "POST",
      path: "/redemptions/stack",
      summary: "Redeem multiple vouchers against one order in a single transaction",
    })
    .input(stackRedeemInput)
    .output(stackRedeemOutput),

  transactions: oc
    .route({
      method: "GET",
      path: "/vouchers/{code}/transactions",
      summary: "Gift card balance ledger",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ code: z.string() }) }))
    .output(
      z.object({
        data: z.array(
          z.object({
            id: z.string().uuid(),
            redemptionId: z.string().uuid().nullable(),
            delta: z.number().int(),
            balanceAfter: z.number().int(),
            reason: z.enum(["CREDIT", "REDEMPTION", "ROLLBACK", "ADJUSTMENT"]),
            createdAt: z.string().datetime(),
          }),
        ),
      }),
    ),
};
