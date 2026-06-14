import { oc } from "@orpc/contract";
import { z } from "zod";
import { paginatedOutput, paginationInput } from "../schemas/pagination.ts";
import {
  referralCodeOutput,
  referralConversionOutput,
  referralConvertInput,
  referralConvertOutput,
  referralIssueInput,
  referralIssueOutput,
  referralProgramConversionOutput,
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
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
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
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }), body: z.object({ patch: referralProgramUpdateInput }) }))
    .output(referralProgramOutput),
  delete: oc
    .route({
      method: "DELETE",
      path: "/referral-programs/{id}",
      summary: "Soft-delete referral program",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ id: z.string().uuid() }) }))
    .output(z.object({ ok: z.literal(true) })),
};

export const referrals = {
  programs,
  listCodes: oc
    .route({
      method: "GET",
      path: "/referral-programs/{programId}/codes",
      summary: "List referral codes in a program",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ programId: z.string().uuid() }), query: paginationInput }))
    .output(paginatedOutput(referralCodeOutput)),
  listConversions: oc
    .route({
      method: "GET",
      path: "/referral-codes/{codeId}/conversions",
      summary: "List conversions for a referral code",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ codeId: z.string().uuid() }), query: paginationInput }))
    .output(paginatedOutput(referralConversionOutput)),
  listProgramConversions: oc
    .route({
      method: "GET",
      path: "/referral-programs/{programId}/conversions",
      summary: "List conversions in a referral program",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ programId: z.string().uuid() }), query: paginationInput }))
    .output(paginatedOutput(referralProgramConversionOutput)),
  getByCode: oc
    .route({
      method: "GET",
      path: "/referrals/{code}",
      summary: "Look up a referral code",
      inputStructure: "detailed",
    })
    .input(z.object({ params: z.object({ code: z.string() }) }))
    .output(referralCodeOutput),
  issue: oc
    .route({
      method: "POST",
      path: "/referrals/issue",
      summary: "Issue (or fetch) a referral code for a customer",
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
