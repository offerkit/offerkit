import { oc } from "@orpc/contract";
import { z } from "zod";
import { campaigns } from "./routes/campaigns.ts";
import { customers } from "./routes/customers.ts";
import { rewardTypes } from "./routes/reward-types.ts";
import { segments } from "./routes/segments.ts";
import { validationRules } from "./routes/validation-rules.ts";
import { vouchers } from "./routes/vouchers.ts";

const healthOutput = z.object({
  status: z.literal("ok"),
  version: z.string(),
});

export const contract = {
  health: oc
    .route({ method: "GET", path: "/health", summary: "Liveness probe" })
    .output(healthOutput),
  ready: oc
    .route({ method: "GET", path: "/ready", summary: "Readiness probe (db + worker)" })
    .output(
      z.object({
        status: z.enum(["ok", "degraded"]),
        checks: z.object({
          db: z.boolean(),
          worker: z.boolean(),
        }),
      }),
    ),
  customers,
  segments,
  campaigns,
  vouchers,
  validationRules,
  rewardTypes,
};

export type Contract = typeof contract;
