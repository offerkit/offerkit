import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { checkAndRecordIdempotency } from "@/server/middleware/idempotency";
import {
  E2E_ENABLED,
  TEST_DB_URL,
  deleteTestKey,
  getTestDb,
  mintTestKey,
  randomId,
  rawRequest,
} from "./_helpers";

let db: Db | undefined;
let token: string | undefined;
let prefix: string | undefined;

beforeAll(async () => {
  if (!E2E_ENABLED || !TEST_DB_URL) return;
  ({ db } = await getTestDb(TEST_DB_URL));
  const minted = await mintTestKey(db);
  token = minted.token;
  prefix = minted.prefix;
}, 30_000);

afterAll(async () => {
  if (db && prefix) await deleteTestKey(db, prefix);
});

function buildRequest(
  body: unknown,
  idempotencyKey: string,
  authToken: string,
): Request {
  return new Request("http://test.local/api/v1/campaigns", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": idempotencyKey,
      authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify(body),
  });
}

describe.skipIf(!E2E_ENABLED)("Idempotency-Key header", () => {
  it("a simultaneous same-key burst executes the mutation only once", async () => {
    if (!token) throw new Error("setup failed");
    const authToken = token;
    const key = `idem-${randomId("k")}`;
    const body = {
      name: randomId("camp-idem"),
      type: "DISCOUNT" as const,
      currency: "USD",
    };

    const responses = await Promise.all(
      Array.from({ length: 12 }, () => rawRequest(buildRequest(body, key, authToken))),
    );
    expect(responses.every((response) => response.status < 400)).toBe(true);
    const results = (await Promise.all(responses.map((response) => response.json()))) as Array<{
      id: string;
    }>;
    expect(results[0]?.id).toBeTruthy();
    expect(new Set(results.map((result) => result.id)).size).toBe(1);

    if (!db) throw new Error("setup failed");
    const [created] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.campaign)
      .where(eq(schema.campaign.name, body.name));
    expect(created?.count).toBe(1);
  });

  it("serializes concurrent callers before executing run", async () => {
    const key = `idem-direct-${randomId("k")}`;
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstStarted!: () => void;
    const firstDidStart = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const run = vi.fn(async () => {
      firstStarted();
      await firstCanFinish;
      return { output: { id: "one-result" } };
    });

    const first = checkAndRecordIdempotency(["test", "create"], key, { value: 1 }, run);
    await firstDidStart;
    const second = checkAndRecordIdempotency(["test", "create"], key, { value: 1 }, run);

    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(run).toHaveBeenCalledTimes(1);

    releaseFirst();
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(firstResult.kind).toBe("fresh");
    expect(secondResult).toEqual({ kind: "replay", output: { id: "one-result" } });
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("rejects a different body while the key is concurrently pending", async () => {
    const key = `idem-pending-conflict-${randomId("k")}`;
    let releaseFirst!: () => void;
    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let firstStarted!: () => void;
    const firstDidStart = new Promise<void>((resolve) => {
      firstStarted = resolve;
    });
    const run = vi.fn(async () => {
      firstStarted();
      await firstCanFinish;
      return { output: { id: "one-result" } };
    });

    const first = checkAndRecordIdempotency(["test", "create"], key, { value: 1 }, run);
    await firstDidStart;
    const second = checkAndRecordIdempotency(
      ["test", "create"],
      key,
      { value: 2 },
      run,
    );
    const conflicting = expect(second).rejects.toMatchObject({ code: "CONFLICT" });

    releaseFirst();
    await Promise.all([first, conflicting]);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("rolls back a failed pending claim so the key can be retried", async () => {
    const key = `idem-retry-${randomId("k")}`;
    const path = ["test", "create"] as const;
    const input = { value: 1 };

    await expect(
      checkAndRecordIdempotency(path, key, input, async () => {
        throw new Error("mutation failed");
      }),
    ).rejects.toThrow("mutation failed");

    const retried = await checkAndRecordIdempotency(path, key, input, async () => ({
      output: { id: "retry-succeeded" },
    }));
    expect(retried).toEqual({
      kind: "fresh",
      result: { output: { id: "retry-succeeded" } },
    });
  });

  it("reclaims an abandoned pending claim after its lease expires", async () => {
    if (!db) throw new Error("setup failed");
    const key = `idem-abandoned-${randomId("k")}`;
    const input = { value: 1 };
    const requestHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    await db.insert(schema.idempotencyRecord).values({
      scope: "test.create",
      idempotencyKey: key,
      requestHash,
      status: "pending",
      ownerToken: "abandoned-owner",
      lockedUntil: new Date(Date.now() - 1_000),
      responseStatus: null,
      responseBody: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    const recovered = await checkAndRecordIdempotency(
      ["test", "create"],
      key,
      input,
      async () => ({ output: { id: "recovered" } }),
    );
    expect(recovered).toEqual({
      kind: "fresh",
      result: { output: { id: "recovered" } },
    });
  });

  it("same key + different body returns 409 conflict", async () => {
    if (!token) throw new Error("setup failed");
    const key = `idem-conflict-${randomId("k")}`;

    const first = await rawRequest(
      buildRequest(
        { name: randomId("camp-a"), type: "DISCOUNT" as const, currency: "USD" },
        key,
        token,
      ),
    );
    expect(first.status).toBeLessThan(400);

    const conflict = await rawRequest(
      buildRequest(
        { name: randomId("camp-b"), type: "DISCOUNT" as const, currency: "USD" },
        key,
        token,
      ),
    );
    expect(conflict.status).toBe(409);
  });
});
