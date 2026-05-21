import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { schema, type Db } from "@offerkit/db";
import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { logger } from "../observability/index.ts";

const log = logger.child({ component: "jobs" });
const DEFAULT_QUEUE_NAME = "offerkit:jobs";

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

export interface EnqueueJobOptions {
  runAt?: Date;
  maxAttempts?: number;
}

export interface RunJobQueueOptions {
  registry: JobRegistry;
  workerId: string;
  pollIntervalMs?: number;
  signal?: AbortSignal;
  onTick?: () => void;
}

export interface JobQueueAdapter {
  enqueue(type: string, payload?: Record<string, unknown>, options?: EnqueueJobOptions): Promise<string>;
  ensureScheduled(type: string, runAt: Date, payload?: Record<string, unknown>): Promise<void>;
  run(options: RunJobQueueOptions): Promise<void>;
  close(): Promise<void>;
  /** Test-only escape hatch for injected fake workers. */
  currentWorkerForTests?: unknown;
}

type QueueLike = {
  add(name: string, data: unknown, opts: Record<string, unknown>): Promise<{ id?: string | number }>;
  getJob(id: string): Promise<unknown>;
  close(): Promise<void>;
};

type WorkerLike = {
  on(event: string, handler: (...args: unknown[]) => void): WorkerLike;
  close(): Promise<void>;
};

type QueueCtor = new (name: string, options: Record<string, unknown>) => QueueLike;
type WorkerCtor = new (
  name: string,
  processor: (job: { id?: string | number; name: string; data: unknown; attemptsMade: number }) => Promise<void>,
  options: Record<string, unknown>,
) => WorkerLike;

export interface RedisJobQueueOptions {
  redisUrl: string;
  queueName?: string;
  QueueCtor?: QueueCtor;
  WorkerCtor?: WorkerCtor;
}

export function createRedisJobQueue(options: RedisJobQueueOptions): JobQueueAdapter {
  const queueName = options.queueName ?? DEFAULT_QUEUE_NAME;
  const connection = createRedisConnection(options.redisUrl);
  const queue = new (options.QueueCtor ?? (Queue as unknown as QueueCtor))(queueName, { connection });
  let worker: WorkerLike | undefined;
  let resolveRun: (() => void) | undefined;
  let runPromise: Promise<void> | undefined;

  const adapter: JobQueueAdapter = {
    async enqueue(type, payload = {}, enqueueOptions = {}) {
      const job = await queue.add(type, payload, {
        delay: delayUntil(enqueueOptions.runAt),
        attempts: enqueueOptions.maxAttempts ?? 5,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: false,
      });
      return String(job.id);
    },

    async ensureScheduled(type, runAt, payload = {}) {
      const jobId = `scheduled:${type}`;
      const existing = await queue.getJob(jobId);
      if (existing) return;
      await queue.add(type, payload, {
        jobId,
        delay: delayUntil(runAt),
        attempts: 5,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: false,
      });
    },

    async run(runOptions) {
      if (runPromise) return runPromise;
      worker = new (options.WorkerCtor ?? (Worker as unknown as WorkerCtor))(
        queueName,
        async (job) => {
          const handler = runOptions.registry.get(job.name);
          if (!handler) throw new Error(`no handler for ${job.name}`);
          await handler({
            jobId: String(job.id),
            attempt: job.attemptsMade + 1,
            payload: asPayload(job.data),
          });
          runOptions.onTick?.();
        },
        { connection, concurrency: 5 },
      );
      adapter.currentWorkerForTests = worker;
      worker
        .on("completed", () => runOptions.onTick?.())
        .on("failed", (job, err) => log.warn({ job, err }, "redis job failed"));

      runOptions.signal?.addEventListener("abort", () => {
        void adapter.close();
      });

      log.info({ workerId: runOptions.workerId, queueName, types: runOptions.registry.types() }, "redis worker started");
      runPromise = new Promise<void>((resolve) => {
        resolveRun = resolve;
      });
      return runPromise;
    },

    async close() {
      await worker?.close();
      worker = undefined;
      await queue.close();
      const redisConnection = connection as { disconnect?: () => void };
      redisConnection.disconnect?.();
      resolveRun?.();
    },
  };

  return adapter;
}

function createRedisConnection(redisUrl: string): unknown {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null });
}

function asPayload(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function delayUntil(runAt: Date | undefined): number {
  if (!runAt) return 0;
  return Math.max(0, runAt.getTime() - Date.now());
}

export function createPostgresJobQueue(db: Db): JobQueueAdapter {
  return {
    enqueue: (type, payload = {}, options = {}) => enqueuePostgresJob(db, type, payload, options),
    ensureScheduled: (type, runAt, payload = {}) => ensurePostgresScheduled(db, type, runAt, payload),
    run: (options) => runPostgresWorker({ ...options, db }),
    close: async () => {},
  };
}

let redisQueueSingleton: JobQueueAdapter | undefined;

function defaultQueue(db: Db): JobQueueAdapter {
  const redisUrl = process.env["REDIS_URL"];
  if (!redisUrl) return createPostgresJobQueue(db);
  redisQueueSingleton ??= createRedisJobQueue({ redisUrl });
  return redisQueueSingleton;
}

export async function enqueueJob(
  db: Db,
  type: string,
  payload: Record<string, unknown> = {},
  options: EnqueueJobOptions = {},
): Promise<string> {
  return defaultQueue(db).enqueue(type, payload, options);
}

export async function ensureScheduled(
  db: Db,
  type: string,
  runAt: Date,
  payload: Record<string, unknown> = {},
): Promise<void> {
  return defaultQueue(db).ensureScheduled(type, runAt, payload);
}

async function enqueuePostgresJob(
  db: Db,
  type: string,
  payload: Record<string, unknown> = {},
  options: EnqueueJobOptions = {},
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
 * same type already exists. Used as the Postgres fallback when REDIS_URL
 * is not configured.
 */
async function ensurePostgresScheduled(
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
  await enqueuePostgresJob(db, type, payload, { runAt });
}

interface RunPostgresWorkerOptions extends RunJobQueueOptions {
  db: Db;
}

export async function runWorker(options: RunPostgresWorkerOptions): Promise<void> {
  return defaultQueue(options.db).run(options);
}

async function runPostgresWorker(options: RunPostgresWorkerOptions): Promise<void> {
  const { db, registry, workerId } = options;
  const pollMs = options.pollIntervalMs ?? 2000;
  log.info({ workerId, types: registry.types() }, "postgres worker started");

  while (!options.signal?.aborted) {
    const claimed = await claimNext(db, workerId);
    if (claimed) {
      await processJob(db, registry, claimed);
    }
    options.onTick?.();
    if (!claimed) await sleep(pollMs, options.signal);
  }
  log.info({ workerId }, "postgres worker stopping");
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
  if (process.env["REDIS_URL"]) return 0;
  const cutoff = new Date(Date.now() - ttlMs);
  const result = await db
    .update(schema.job)
    .set({ status: "pending", lockedBy: null, lockedAt: null })
    .where(
      and(
        eq(schema.job.status, "running"),
        or(isNull(schema.job.lockedAt), lte(schema.job.lockedAt, cutoff)),
      ),
    )
    .returning({ id: schema.job.id });
  return result.length;
}
