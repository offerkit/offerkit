import { oc } from "@orpc/contract";
import { z } from "zod";

const counters = z.object({
  redemptionsToday: z.number().int(),
  redemptions7d: z.number().int(),
  redemptions30d: z.number().int(),
});

const daily = z.array(z.object({ day: z.string(), total: z.number().int() }));

const topCampaigns = z.array(
  z.object({
    campaignId: z.string().uuid(),
    campaignName: z.string(),
    redemptions: z.number().int(),
  }),
);

const failures = z.array(z.object({ reason: z.string(), total: z.number().int() }));

const webhooks = z.array(
  z.object({
    status: z.enum(["pending", "succeeded", "failed", "dead"]),
    total: z.number().int(),
  }),
);

export const insights = {
  summary: oc
    .route({
      method: "GET",
      path: "/insights/summary",
      summary: "Headline metrics for the dashboard insights page",
    })
    .output(
      z.object({
        sinceDays: z.number().int(),
        counters,
        daily,
        topCampaigns,
        failures,
        webhooks,
      }),
    ),
};
