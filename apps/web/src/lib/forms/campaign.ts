import { z } from "zod";
import {
  campaignCreateInput,
  campaignName,
  campaignStatus,
  campaignType,
  campaignUpdateInput,
  codeConfig,
} from "@offerkit/contract";
import { optionalLocalDateTime, toIsoOrUndefined, validateDateRange } from "./shared";

export const campaignFormSchema = z
  .object({
    name: campaignName,
    description: campaignCreateInput.shape.description.unwrap(),
    type: campaignType,
    status: campaignStatus,
    currency: campaignCreateInput.shape.currency,
    timezone: campaignCreateInput.shape.timezone.unwrap(),
    startDate: optionalLocalDateTime,
    endDate: optionalLocalDateTime,
    perUserRedemptionLimit: z.union([
      z.literal(""),
      campaignCreateInput.shape.perUserRedemptionLimit.unwrap(),
    ]),
    autoApply: z.boolean(),
    codeLength: codeConfig.shape.length.unwrap(),
    codePrefix: codeConfig.shape.prefix.unwrap(),
  })
  .superRefine(validateDateRange);

export type CampaignFormState = z.infer<typeof campaignFormSchema>;
export type CampaignCreateInput = z.infer<typeof campaignCreateInput>;
export type CampaignUpdateInput = z.infer<typeof campaignUpdateInput>;

function commonCampaignInput(state: CampaignFormState) {
  return {
    name: state.name,
    description: state.description || undefined,
    currency: state.currency,
    timezone: state.timezone || undefined,
    startDate: toIsoOrUndefined(state.startDate),
    endDate: toIsoOrUndefined(state.endDate),
    perUserRedemptionLimit:
      state.perUserRedemptionLimit === "" ? undefined : state.perUserRedemptionLimit,
    autoApply: state.autoApply,
    codeConfig: {
      length: state.codeLength,
      prefix: state.codePrefix || undefined,
    },
  };
}

export function campaignFormToCreateInput(state: CampaignFormState): CampaignCreateInput {
  return campaignCreateInput.parse({
    ...commonCampaignInput(state),
    type: state.type,
  });
}

export function campaignFormToUpdateInput(state: CampaignFormState): CampaignUpdateInput {
  return campaignUpdateInput.parse({
    ...commonCampaignInput(state),
    status: state.status,
  });
}
