import { oc } from "@orpc/contract";
import { z } from "zod";
import { mcpMeta } from "../mcp.ts";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";
import {
  loyaltyAdjustInput,
  loyaltyEarnInput,
  loyaltyEarningRuleCreateInput,
  loyaltyEarningRuleOutput,
  loyaltyEarningRuleUpdateInput,
  loyaltyMemberEnrollInput,
  loyaltyMemberOutput,
  loyaltyProgramCreateInput,
  loyaltyProgramOutput,
  loyaltyProgramUpdateInput,
  loyaltyRedeemInput,
  loyaltyRewardCreateInput,
  loyaltyRewardOutput,
  loyaltyRewardPayload,
  loyaltyRewardUpdateInput,
  loyaltyTierCreateInput,
  loyaltyTierOutput,
  loyaltyTierUpdateInput,
  loyaltyTransactionOutput,
} from "../schemas/loyalty.ts";

const programs = {
  list: oc
    .route({ method: "GET", path: "/loyalty/programs", summary: "List loyalty programs" })
    .input(paginationInput)
    .output(paginatedOutput(loyaltyProgramOutput)),
  get: oc
    .route({
      method: "GET",
      path: "/loyalty/programs/{id}",
      summary: "Get loyalty program",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(loyaltyProgramOutput),
  create: oc
    .route({ method: "POST", path: "/loyalty/programs", summary: "Create loyalty program" })
    .input(loyaltyProgramCreateInput)
    .output(loyaltyProgramOutput),
  update: oc
    .route({
      method: "PATCH",
      path: "/loyalty/programs/{id}",
      summary: "Update loyalty program",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ patch: loyaltyProgramUpdateInput }) }))
    .output(loyaltyProgramOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/loyalty/programs/{id}",
      summary: "Soft-delete program",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(z.object({ ok: z.literal(true) })),
};

const tiers = {
  list: oc
    .route({
      method: "GET",
      path: "/loyalty/programs/{programId}/tiers",
      summary: "List tiers",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ programId: z.string().uuid() }) }))
    .output(z.object({ data: z.array(loyaltyTierOutput) })),
  create: oc
    .route({ method: "POST", path: "/loyalty/tiers", summary: "Create tier" })
    .input(loyaltyTierCreateInput)
    .output(loyaltyTierOutput),
  update: oc
    .route({
      method: "PATCH",
      path: "/loyalty/tiers/{id}",
      summary: "Update tier",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ patch: loyaltyTierUpdateInput }) }))
    .output(loyaltyTierOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/loyalty/tiers/{id}",
      summary: "Delete tier",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(z.object({ ok: z.literal(true) })),
};

const earningRules = {
  list: oc
    .route({
      method: "GET",
      path: "/loyalty/programs/{programId}/earning-rules",
      summary: "List earning rules",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ programId: z.string().uuid() }) }))
    .output(z.object({ data: z.array(loyaltyEarningRuleOutput) })),
  create: oc
    .route({ method: "POST", path: "/loyalty/earning-rules", summary: "Create earning rule" })
    .input(loyaltyEarningRuleCreateInput)
    .output(loyaltyEarningRuleOutput),
  update: oc
    .route({
      method: "PATCH",
      path: "/loyalty/earning-rules/{id}",
      summary: "Update earning rule",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ patch: loyaltyEarningRuleUpdateInput }) }))
    .output(loyaltyEarningRuleOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/loyalty/earning-rules/{id}",
      summary: "Delete earning rule",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(z.object({ ok: z.literal(true) })),
};

const rewards = {
  list: oc
    .route({
      method: "GET",
      path: "/loyalty/programs/{programId}/rewards",
      summary: "List rewards",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ programId: z.string().uuid() }) }))
    .output(z.object({ data: z.array(loyaltyRewardOutput) })),
  create: oc
    .route({ method: "POST", path: "/loyalty/rewards", summary: "Create reward" })
    .input(loyaltyRewardCreateInput)
    .output(loyaltyRewardOutput),
  update: oc
    .route({
      method: "PATCH",
      path: "/loyalty/rewards/{id}",
      summary: "Update reward",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ patch: loyaltyRewardUpdateInput }) }))
    .output(loyaltyRewardOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/loyalty/rewards/{id}",
      summary: "Soft-delete reward",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(z.object({ ok: z.literal(true) })),
};

const members = {
  list: oc
    .route({
      method: "GET",
      path: "/loyalty/programs/{programId}/members",
      summary: "List members of a program",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ programId: z.string().uuid() }), query: paginationInput }))
    .output(paginatedOutput(loyaltyMemberOutput)),
  get: oc
    .route({
      method: "GET",
      path: "/loyalty/members/{id}",
      summary: "Get member",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(loyaltyMemberOutput),
  enroll: oc
    .route({ method: "POST", path: "/loyalty/members", summary: "Enroll a customer" })
    .input(loyaltyMemberEnrollInput)
    .output(loyaltyMemberOutput),
  earn: oc
    .route({ method: "POST", path: "/loyalty/members/earn", summary: "Earn points" })
    .input(loyaltyEarnInput)
    .output(
      z.object({
        ok: z.boolean(),
        transactionId: z.string().uuid().optional(),
        delta: z.number().int().optional(),
        balance: z.number().int().optional(),
        lifetimePoints: z.number().int().optional(),
        tierId: z.string().uuid().nullable().optional(),
        code: z.string().optional(),
        message: z.string().optional(),
      }),
    ),
  adjust: oc
    .route({ method: "POST", path: "/loyalty/members/adjust", summary: "Manual adjustment" })
    .input(loyaltyAdjustInput)
    .output(
      z.object({
        ok: z.boolean(),
        transactionId: z.string().uuid().optional(),
        balance: z.number().int().optional(),
        code: z.string().optional(),
        message: z.string().optional(),
      }),
    ),
  redeem: oc
    .route({ method: "POST", path: "/loyalty/members/redeem", summary: "Redeem a reward" })
    .input(loyaltyRedeemInput)
    .output(
      z.object({
        ok: z.boolean(),
        transactionId: z.string().uuid().optional(),
        rewardId: z.string().uuid().optional(),
        cost: z.number().int().optional(),
        balance: z.number().int().optional(),
        payload: loyaltyRewardPayload.optional(),
        code: z.string().optional(),
        message: z.string().optional(),
      }),
    ),
  history: oc
    .meta(
      mcpMeta({
        expose: true,
        riskLevel: "safe",
        description: "List a loyalty member's transaction history (earn / redeem / adjust / expiry).",
      }),
    )
    .route({
      method: "GET",
      path: "/loyalty/members/{id}/transactions",
      summary: "Member transaction ledger",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(z.object({ data: z.array(loyaltyTransactionOutput) })),
};

export const loyalty = {
  programs,
  tiers,
  earningRules,
  rewards,
  members,
};
