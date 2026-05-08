import { implement } from "@orpc/server";
import { sql } from "drizzle-orm";
import { contract } from "@open-voucherify/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { apiKeysRouter } from "./api-keys";
import { campaignsRouter } from "./campaigns";
import { customersRouter } from "./customers";
import { loyaltyRouter } from "./loyalty";
import { referralsRouter } from "./referrals";
import { rewardTypesRouter } from "./reward-types";
import { segmentsRouter } from "./segments";
import { validationRulesRouter } from "./validation-rules";
import { vouchersRouter } from "./vouchers";
import { eventsRouter, webhooksRouter } from "./webhooks";
import { insightsRouter } from "./insights";

const os = implement(contract).$context<RequestContext>();

const health = os.health.handler(() => ({
  status: "ok" as const,
  version: process.env["npm_package_version"] ?? "0.0.0",
}));

const ready = os.ready.handler(async () => {
  let dbOk = false;
  try {
    await db().execute(sql`select 1`);
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return {
    status: dbOk ? ("ok" as const) : ("degraded" as const),
    checks: { db: dbOk, worker: true },
  };
});

export const router = os.router({
  health,
  ready,
  customers: customersRouter,
  segments: segmentsRouter,
  campaigns: campaignsRouter,
  vouchers: vouchersRouter,
  validationRules: validationRulesRouter,
  rewardTypes: rewardTypesRouter,
  loyalty: loyaltyRouter,
  referrals: referralsRouter,
  apiKeys: apiKeysRouter,
  webhooks: webhooksRouter,
  events: eventsRouter,
  insights: insightsRouter,
});
