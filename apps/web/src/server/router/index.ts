import { implement } from "@orpc/server";
import { sql } from "drizzle-orm";
import { contract } from "@open-voucherify/contract/router";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { campaignsRouter } from "./campaigns";
import { customersRouter } from "./customers";
import { rewardTypesRouter } from "./reward-types";
import { segmentsRouter } from "./segments";
import { validationRulesRouter } from "./validation-rules";
import { vouchersRouter } from "./vouchers";

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
});
