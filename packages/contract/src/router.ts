import { oc } from "@orpc/contract";
import { z } from "zod";
import { customers } from "./routes/customers.ts";
import { segments } from "./routes/segments.ts";

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
};

export type Contract = typeof contract;
