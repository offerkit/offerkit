import { oc } from "@orpc/contract";
import { z } from "zod";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";
import {
  referralConvertInput,
  referralConvertOutput,
  referralIssueInput,
  referralIssueOutput,
  referralOutput,
  referralProgramCreateInput,
  referralProgramOutput,
  referralProgramUpdateInput,
} from "../schemas/referral.ts";

const programs = {
  list: oc
    .route({
      method: "GET",
      path: "/referral-programs",
      summary: "List referral programs",
    })
    .input(paginationInput)
    .output(paginatedOutput(referralProgramOutput)),
  get: oc
    .route({
      method: "GET",
      path: "/referral-programs/{id}",
      summary: "Get referral program",
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(referralProgramOutput),
  create: oc
    .route({
      method: "POST",
      path: "/referral-programs",
      summary: "Create referral program",
    })
    .input(referralProgramCreateInput)
    .output(referralProgramOutput),
  update: oc
    .route({
      method: "PATCH",
      path: "/referral-programs/{id}",
      summary: "Update referral program",
    })
    .input(z.object({ id: z.string().uuid(), patch: referralProgramUpdateInput }))
    .output(referralProgramOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/referral-programs/{id}",
      summary: "Soft-delete referral program",
    })
    .input(z.object({ id: z.string().uuid() }))
    .output(z.object({ ok: z.literal(true) })),
};

export const referrals = {
  programs,
  listReferrals: oc
    .route({
      method: "GET",
      path: "/referral-programs/{programId}/referrals",
      summary: "List referrals in a program",
    })
    .input(paginationInput.extend({ programId: z.string().uuid() }))
    .output(paginatedOutput(referralOutput)),
  getByCode: oc
    .route({
      method: "GET",
      path: "/referrals/{code}",
      summary: "Look up a referral by code",
    })
    .input(z.object({ code: z.string() }))
    .output(referralOutput),
  issue: oc
    .route({
      method: "POST",
      path: "/referrals/issue",
      summary: "Issue a referral code for a customer",
    })
    .input(referralIssueInput)
    .output(referralIssueOutput),
  convert: oc
    .route({
      method: "POST",
      path: "/referrals/convert",
      summary: "Convert a referral and issue both rewards",
    })
    .input(referralConvertInput)
    .output(referralConvertOutput),
};
