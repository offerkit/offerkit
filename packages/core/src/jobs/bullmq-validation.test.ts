import { Job, Queue } from "bullmq";
import IORedis from "ioredis";
import { afterEach, describe, expect, it } from "vitest";
import { createRedisJobQueue, type JobQueueAdapter } from "./index.ts";

// Real BullMQ Queue/Job classes with a lazy, never-connected Redis client, so
// BullMQ's own queue name and custom job id validation runs without a server.
const added: Array<{ name: string; opts: Record<string, unknown> }> = [];

class ValidatingJob extends Job {
  validate(data: unknown) {
    this.validateOptions({ data: JSON.stringify(data) } as never);
  }
}

class ValidatingQueue extends Queue {
  constructor(name: string, options: Record<string, unknown>) {
    (options.connection as { disconnect?: () => void }).disconnect?.();
    super(name, { ...options, connection: new IORedis({ lazyConnect: true, maxRetriesPerRequest: null }) });
  }

  override add(name: string, data: unknown, opts: Record<string, unknown> = {}) {
    new ValidatingJob(this, name, data, opts).validate(data);
    added.push({ name, opts });
    return Promise.resolve({ id: (opts.jobId as string | undefined) ?? "generated-id" }) as never;
  }

  override getJob() {
    return Promise.resolve(undefined);
  }
}

describe("createRedisJobQueue with real BullMQ validation", () => {
  let queue: JobQueueAdapter | undefined;

  afterEach(async () => {
    await queue?.close();
    queue = undefined;
    added.length = 0;
  });

  it("uses a default queue name and scheduled job ids that BullMQ accepts", async () => {
    queue = createRedisJobQueue({
      redisUrl: "redis://localhost:6379",
      QueueCtor: ValidatingQueue,
    });

    await queue.ensureScheduled("loyalty.points.expire", new Date());
    await queue.enqueue("webhook.deliver", { deliveryId: "del_1" });

    expect(added.map((job) => job.name)).toEqual(["loyalty.points.expire", "webhook.deliver"]);
    expect(added[0]?.opts.jobId).toBe("scheduled-loyalty.points.expire");
  });
});
