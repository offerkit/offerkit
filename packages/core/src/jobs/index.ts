import { schema, type Db } from "@open-voucherify/db";
import { and, eq, lte, or, sql } from "drizzle-orm";
import { logger } from "../observability/index.ts";

const log = logger.child({ component: "jobs" });

export interface JobContext {
  jobId: string;
  attempt: number;
  payload: Record<string, unknown>;
}

export type JobHandler = (ctx: JobContext) => Promise<void>;

export interface JobRegistry {
  register(type: string, handler: JobHandler): void;
  get(type: string): JobHandler | undefined;
  types(): string[];
}

export function createJobRegistry(): JobRegistry {
  const handlers = new Map<string, JobHandler>();
  return {
    register(type, handler) {
      handlers.set(type, handler);
    },
    get(type) {
      return handlers.get(type);
    },
    types() {
      return [...handlers.keys()];
    },
  };
}

export async function enqueueJob(
  db: Db,
  type: string,
  payload: Record<string, unknown> = {},
  options: { runAt?: Date; maxAttempts?: number } = {},
): Promise<string> {
  const [row] = await db
    .insert(schema.job)
    .values({
      type,
      payload,
      runAt: options.runAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? 5,
    })
    .returning({ id: schema.job.id });
  if (!row) throw new Error("failed to enqueue job");
  return row.id;
}

/**
 * Idempotent scheduler: enqueues a job only if no pending row of the
 * same type already exists. Use for periodic / recurring jobs that
 * should re-schedule themselves — boot enqueues the first run, and
 * subsequent ones are scheduled by the handler when it finishes.
 *
 * Safe under multiple worker replicas: races at worst produce one
 * extra row, which the next run dedupes via the same check.
 */
export async function ensureScheduled(
  db: Db,
  type: string,
  runAt: Date,
  payload: Record<string, unknown> = {},
): Promise<void> {
  const existing = await db
    .select({ id: schema.job.id })
    .from(schema.job)
    .where(and(eq(schema.job.type, type), eq(schema.job.status, "pending")))
    .limit(1);
  if (existing.length > 0) return;
  await enqueueJob(db, type, payload, { runAt });
}

interface RunWorkerOptions {
  db: Db;
  registry: JobRegistry;
  workerId: string;
  pollIntervalMs?: number;
  signal?: AbortSignal;
}

export async function runWorker(options: RunWorkerOptions): Promise<void> {
  const { db, registry, workerId } = options;
  const pollMs = options.pollIntervalMs ?? 2000;
  log.info({ workerId, types: registry.types() }, "worker started");

  while (!options.signal?.aborted) {
    const claimed = await claimNext(db, workerId);
    if (!claimed) {
      await sleep(pollMs, options.signal);
      continue;
    }
    await processJob(db, registry, claimed);
  }
  log.info({ workerId }, "worker stopping");
}

interface ClaimedJob extends Record<string, unknown> {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

async function claimNext(db: Db, workerId: string): Promise<ClaimedJob | undefined> {
  const result = await db.execute<ClaimedJob>(sql`
    UPDATE ${schema.job}
    SET status = 'running',
        locked_by = ${workerId},
        locked_at = now(),
        attempts = attempts + 1,
        updated_at = now()
    WHERE id = (
      SELECT id FROM ${schema.job}
      WHERE status = 'pending'
        AND run_at <= now()
      ORDER BY run_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id, type, payload, attempts, max_attempts AS "maxAttempts"
  `);
  return result.rows[0];
}

async function processJob(db: Db, registry: JobRegistry, job: ClaimedJob): Promise<void> {
  const handler = registry.get(job.type);
  if (!handler) {
    await markFailed(db, job, `no handler for ${job.type}`, true);
    return;
  }
  try {
    await handler({ jobId: job.id, attempt: job.attempts, payload: job.payload });
    await markCompleted(db, job.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const dead = job.attempts >= job.maxAttempts;
    await markFailed(db, job, message, dead);
  }
}

async function markCompleted(db: Db, id: string): Promise<void> {
  await db
    .update(schema.job)
    .set({ status: "completed", completedAt: new Date(), lockedBy: null, lockedAt: null })
    .where(eq(schema.job.id, id));
}

async function markFailed(db: Db, job: ClaimedJob, reason: string, dead: boolean): Promise<void> {
  await db
    .update(schema.job)
    .set({
      status: dead ? "dead" : "pending",
      lastError: reason,
      lockedBy: null,
      lockedAt: null,
      runAt: dead ? new Date() : new Date(Date.now() + backoffMs(job.attempts)),
    })
    .where(eq(schema.job.id, job.id));
}

function backoffMs(attempt: number): number {
  // Exponential backoff capped at 1 hour
  return Math.min(1000 * 60 * 60, 1000 * 2 ** attempt);
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });
}

export async function reclaimStaleJobs(db: Db, ttlMs: number): Promise<number> {
  const cutoff = new Date(Date.now() - ttlMs);
  const result = await db
    .update(schema.job)
    .set({ status: "pending", lockedBy: null, lockedAt: null })
    .where(
      and(
        eq(schema.job.status, "running"),
        or(eq(schema.job.lockedAt, null as unknown as Date), lte(schema.job.lockedAt, cutoff)),
      ),
    )
    .returning({ id: schema.job.id });
  return result.length;
}
