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
import { expirePoints } from "@open-voucherify/core/loyalty";
import { initOtel, logger } from "@open-voucherify/core/observability";

initOtel({ serviceName: "open-voucherify-worker" });
const log = logger.child({ component: "worker" });

const workerId = `worker-${randomUUID()}`;
const db = getDb();
const registry = createJobRegistry();

registry.register("noop.heartbeat", ({ jobId }) => {
  log.info({ jobId }, "heartbeat");
  return Promise.resolve();
});

// Daily loyalty sweep that schedules its own next run after success.
// Boot calls ensureScheduled() so a freshly-deployed db gets the first
// row; from then on the queue is the source of truth for cadence.
const LOYALTY_EXPIRE_INTERVAL_MS = 24 * 60 * 60_000;
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
const shutdown = (signal: string) => {
  log.info({ signal }, "shutting down");
  controller.abort();
  setTimeout(() => process.exit(0), 1000);
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

// Reclaim orphaned jobs on boot, then heartbeat every minute.
async function bootstrap() {
  const reclaimed = await reclaimStaleJobs(db, 5 * 60_000);
  if (reclaimed > 0) log.info({ reclaimed }, "reclaimed orphaned jobs");

  await enqueueJob(db, "noop.heartbeat", { ts: new Date().toISOString() });
  setInterval(() => {
    void enqueueJob(db, "noop.heartbeat", { ts: new Date().toISOString() }).then(() => {
      lastHeartbeat = Date.now();
    });
  }, 60_000);

  // Seed the recurring loyalty sweep. The handler reschedules itself,
  // so boot only ensures one row exists; multiple replicas converge.
  await ensureScheduled(db, "loyalty.points.expire", new Date());
}

void bootstrap();

await runWorker({ db, registry, workerId, signal: controller.signal });
