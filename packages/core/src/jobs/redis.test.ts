import { describe, expect, it, vi } from "vitest";
import { createRedisJobQueue, createJobRegistry } from "./index.ts";

class FakeQueue {
  static calls: Array<{ name: string; data: unknown; opts: Record<string, unknown> }> = [];
  static jobs = new Map<string, unknown>();

  constructor(public name: string, public options: Record<string, unknown>) {}

  async add(name: string, data: unknown, opts: Record<string, unknown>): Promise<{ id?: string | number }> {
    FakeQueue.calls.push({ name, data, opts });
    const id = typeof opts.jobId === "string" || typeof opts.jobId === "number" ? opts.jobId : "generated-id";
    if (opts.jobId) FakeQueue.jobs.set(String(opts.jobId), { id: opts.jobId });
    return { id };
  }

  async getJob(id: string) {
    return FakeQueue.jobs.get(id);
  }

  async close() {}
}

class FakeWorker {
  processor: (job: { id?: string; name: string; data: unknown; attemptsMade: number }) => Promise<void>;

  constructor(_name: string, processor: FakeWorker["processor"], _options: unknown) {
    this.processor = processor;
  }

  on() {
    return this;
  }

  async close() {}
}

describe("createRedisJobQueue", () => {
  it("enqueues jobs into BullMQ with delay and retry metadata", async () => {
    FakeQueue.calls = [];
    FakeQueue.jobs.clear();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const queue = createRedisJobQueue({
      redisUrl: "redis://localhost:6379",
      queueName: "offerkit-test",
      QueueCtor: FakeQueue,
      WorkerCtor: FakeWorker,
    });

    const id = await queue.enqueue("webhook.deliver", { deliveryId: "del_1" }, {
      runAt: new Date("2026-01-01T00:00:05.000Z"),
      maxAttempts: 7,
    });

    expect(id).toBe("generated-id");
    expect(FakeQueue.calls).toEqual([
      expect.objectContaining({
        name: "webhook.deliver",
        data: { deliveryId: "del_1" },
        opts: expect.objectContaining({
          delay: 5_000,
          attempts: 7,
          backoff: { type: "exponential", delay: 2_000 },
        }),
      }),
    ]);
  });

  it("dedupes scheduled jobs by type", async () => {
    FakeQueue.calls = [];
    FakeQueue.jobs.clear();
    FakeQueue.jobs.set("scheduled:loyalty.points.expire", { id: "scheduled:loyalty.points.expire" });

    const queue = createRedisJobQueue({
      redisUrl: "redis://localhost:6379",
      QueueCtor: FakeQueue,
      WorkerCtor: FakeWorker,
    });

    await queue.ensureScheduled("loyalty.points.expire", new Date("2026-01-01T00:00:00.000Z"));

    expect(FakeQueue.calls).toEqual([]);
  });

  it("dispatches worker jobs to the registry with BullMQ attempt numbers", async () => {
    const registry = createJobRegistry();
    const handled: unknown[] = [];
    registry.register("bulk_codes.generate", async (ctx) => {
      handled.push(ctx);
    });

    const queue = createRedisJobQueue({
      redisUrl: "redis://localhost:6379",
      QueueCtor: FakeQueue,
      WorkerCtor: FakeWorker,
    });
    const workerPromise = queue.run({ registry, workerId: "worker-1" });
    const worker = queue.currentWorkerForTests as FakeWorker;

    await worker.processor({
      id: "job-1",
      name: "bulk_codes.generate",
      data: { campaignId: "cmp_1" },
      attemptsMade: 2,
    });
    await queue.close();
    await workerPromise;

    expect(handled).toEqual([
      { jobId: "job-1", attempt: 3, payload: { campaignId: "cmp_1" } },
    ]);
  });
});
