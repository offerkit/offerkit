import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { getDb } from "@open-voucherify/db";
import {
  createJobRegistry,
  enqueueJob,
  ensureScheduled,
  reclaimStaleJobs,
  runWorker,
} from "@open-voucherify/core/jobs";
import { deliverWebhook } from "@open-voucherify/core/events";
import { expirePoints } from "@open-voucherify/core/loyalty";
import { bulkGenerateCodes, type BulkCodesPayload } from "@open-voucherify/core/codes";
import { initOtel, logger } from "@open-voucherify/core/observability";

initOtel({ serviceName: "open-voucherify-worker" });
const log = logger.child({ component: "worker" });

const workerId = `worker-${randomUUID()}`;
const db = getDb();
const registry = createJobRegistry();

// Daily loyalty sweep that schedules its own next run after success.
// Boot calls ensureScheduled() so a freshly-deployed db gets the first
// row; from then on the queue is the source of truth for cadence.
const LOYALTY_EXPIRE_INTERVAL_MS = 24 * 60 * 60_000;
registry.register("webhook.deliver", async ({ jobId, payload }) => {
  const deliveryId = (payload as { deliveryId?: string }).deliveryId;
  if (!deliveryId) {
    log.warn({ jobId }, "webhook.deliver job missing deliveryId");
    return;
  }
  await deliverWebhook(db, { deliveryId });
});

registry.register("bulk_codes.generate", async ({ jobId, payload }) => {
  const typed = payload as Partial<BulkCodesPayload>;
  if (!typed.campaignId || typeof typed.count !== "number") {
    log.warn({ jobId }, "bulk_codes.generate job missing campaignId/count");
    return;
  }
  const result = await bulkGenerateCodes(db, {
    campaignId: typed.campaignId,
    count: typed.count,
  });
  log.info({ jobId, generated: result.generated }, "bulk codes generated");
});

registry.register("loyalty.points.expire", async ({ jobId }) => {
  const result = await expirePoints(db);
  log.info({ jobId, expired: result.expired }, "loyalty points expired");
  await enqueueJob(
    db,
    "loyalty.points.expire",
    {},
    { runAt: new Date(Date.now() + LOYALTY_EXPIRE_INTERVAL_MS) },
  );
});

const controller = new AbortController();
const SHUTDOWN_GRACE_MS = Number(process.env["WORKER_SHUTDOWN_GRACE_MS"] ?? 30_000);
let shuttingDown = false;
const shutdown = (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  log.info({ signal, graceMs: SHUTDOWN_GRACE_MS }, "draining worker");
  controller.abort();
  // Safety net: if an in-flight handler hangs past the grace window, force exit.
  const forceExit = setTimeout(() => {
    log.warn({ signal }, "grace period elapsed, forcing exit");
    process.exit(1);
  }, SHUTDOWN_GRACE_MS);
  forceExit.unref();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Tiny health server for Railway / docker healthcheck.
const healthPort = Number(process.env["WORKER_HEALTH_PORT"] ?? 9091);
let lastHeartbeat = Date.now();
createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (req.url === "/ready") {
    const fresh = Date.now() - lastHeartbeat < 60_000;
    res.writeHead(fresh ? 200 : 503, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: fresh ? "ok" : "degraded", lastHeartbeat }));
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(healthPort, () => {
  log.info({ port: healthPort }, "worker health server listening");
});

// Reclaim orphaned jobs on boot, then seed the recurring sweeps.
async function bootstrap() {
  const reclaimed = await reclaimStaleJobs(db, 5 * 60_000);
  if (reclaimed > 0) log.info({ reclaimed }, "reclaimed orphaned jobs");
  // Seed recurring jobs once. Their handlers reschedule themselves so
  // multiple replicas converge to a single pending row per type.
  await ensureScheduled(db, "loyalty.points.expire", new Date());
}

void bootstrap();

await runWorker({
  db,
  registry,
  workerId,
  signal: controller.signal,
  // Liveness: every poll cycle (whether or not work was claimed) proves
  // the worker reached the DB and is making progress. /ready compares
  // this against now() < 60s.
  onTick: () => {
    lastHeartbeat = Date.now();
  },
});

log.info({ workerId }, "worker drained, exiting");
process.exit(0);
