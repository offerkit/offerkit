import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { getDb } from "@offerkit/db";
import {
  createJobRegistry,
  ensureScheduled,
  reclaimStaleJobs,
  runWorker,
} from "@offerkit/core/jobs";
import { initOtel, logger } from "@offerkit/core/observability";
import {
  LOYALTY_EXPIRE_INTERVAL_MS,
  registerWorkerHandlers,
} from "./handlers.ts";

initOtel({ serviceName: "offerkit-worker" });
const log = logger.child({ component: "worker" });

const workerId = `worker-${randomUUID()}`;
const db = getDb();
const registry = createJobRegistry();

// Daily loyalty sweep that schedules its own next run after success.
// Boot calls ensureScheduled() so a freshly-deployed queue gets the first
// job; from then on Redis/BullMQ is the source of truth for cadence.
registerWorkerHandlers(registry, db);

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
// Honor PORT first (Railway and most PaaS assign it dynamically),
// then WORKER_HEALTH_PORT for explicit overrides, then 9091 default.
const healthPort = Number(process.env["PORT"] ?? process.env["WORKER_HEALTH_PORT"] ?? 9091);
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
}).listen(healthPort, "0.0.0.0", () => {
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
  // Liveness: every adapter tick proves the worker loop or Redis heartbeat
  // is still running. /ready compares this against now() < 60s.
  onTick: () => {
    lastHeartbeat = Date.now();
  },
});

log.info({ workerId }, "worker drained, exiting");
process.exit(0);
