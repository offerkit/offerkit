import { EventEmitter } from "node:events";
import { Job, Queue } from "bullmq";
import { afterEach, describe, expect, it } from "vitest";
import { createRedisJobQueue, type JobQueueAdapter } from "./index.ts";

// Real BullMQ Queue/Job classes with a connection double that never touches the
// network, so BullMQ's own queue name and custom job id validation runs without
// a Redis server.
const added: Array<{ name: string; opts: Record<string, unknown> }> = [];

class OfflineConnection extends EventEmitter {
  readonly client = new Promise<never>(() => {});
  close() {
    return Promise.resolve();
  }
  disconnect() {
    return Promise.resolve();
  }
}

class ValidatingJob extends Job {
  validate(data: unknown) {
    this.validateOptions({ data: JSON.stringify(data) } as never);
  }
}

class ValidatingQueue extends Queue {
  constructor(name: string, options: Record<string, unknown>) {
    (options.connection as { disconnect?: () => void }).disconnect?.();
    super(name, { connection: {} }, OfflineConnection as never);
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
