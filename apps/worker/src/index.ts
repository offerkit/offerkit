import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { getDb } from "@open-voucherify/db";
import {
  createJobRegistry,
  enqueueJob,
  reclaimStaleJobs,
  runWorker,
} from "@open-voucherify/core/jobs";
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
}

void bootstrap();

await runWorker({ db, registry, workerId, signal: controller.signal });
