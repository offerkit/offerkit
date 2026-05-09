import { oc } from "@orpc/contract";
import { z } from "zod";
import { apiKeys } from "./routes/api-keys.ts";
import { campaigns } from "./routes/campaigns.ts";
import { customers } from "./routes/customers.ts";
import { loyalty } from "./routes/loyalty.ts";
import { referrals } from "./routes/referrals.ts";
import { rewardTypes } from "./routes/reward-types.ts";
import { segments } from "./routes/segments.ts";
import { validationRules } from "./routes/validation-rules.ts";
import { vouchers } from "./routes/vouchers.ts";
import { events, webhooks } from "./routes/webhooks.ts";
import { insights } from "./routes/insights.ts";
import { users } from "./routes/users.ts";
import { orders } from "./routes/orders.ts";

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
  loyalty,
  referrals,
  apiKeys,
  webhooks,
  events,
  insights,
  users,
  orders,
};

export type Contract = typeof contract;
