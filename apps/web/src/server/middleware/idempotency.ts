import { createHash, randomUUID } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, eq, isNull, lte, or } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { db } from "@/lib/db";

const IDEMPOTENCY_TTL_HOURS = 24;
const CLAIM_LEASE_MS = 60_000;
const CLAIM_HEARTBEAT_MS = 20_000;
const MAX_POLL_MS = 200;

function hashRequest(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input ?? null)).digest("hex");
}

function serialize(value: unknown): unknown {
  if (value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

interface NextResult {
  output: unknown;
}

type IdempotencyResolution<R extends NextResult> =
  | { kind: "replay"; output: unknown }
  | { kind: "fresh"; result: R };

function conflict(): never {
  throw new ORPCError("CONFLICT", {
    message: "Idempotency-Key reused with a different request body",
  });
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function runClaimed<R extends NextResult>(
  id: string,
  ownerToken: string,
  run: () => Promise<R>,
): Promise<{ kind: "fresh"; result: R }> {
  const heartbeat = setInterval(() => {
    db()
      .update(schema.idempotencyRecord)
      .set({ lockedUntil: new Date(Date.now() + CLAIM_LEASE_MS) })
      .where(
        and(
          eq(schema.idempotencyRecord.id, id),
          eq(schema.idempotencyRecord.status, "pending"),
          eq(schema.idempotencyRecord.ownerToken, ownerToken),
        ),
      )
      .catch(() => {
        // A transient refresh failure is covered by the existing lease. If the
        // owner disappears, another request can reclaim it after lockedUntil.
      });
  }, CLAIM_HEARTBEAT_MS);
  heartbeat.unref();

  try {
    const result = await run();
    clearInterval(heartbeat);

    const [completed] = await db()
      .update(schema.idempotencyRecord)
      .set({
        status: "completed",
        ownerToken: null,
        lockedUntil: null,
        responseStatus: 200,
        responseBody: serialize(result.output),
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000),
      })
      .where(
        and(
          eq(schema.idempotencyRecord.id, id),
          eq(schema.idempotencyRecord.status, "pending"),
          eq(schema.idempotencyRecord.ownerToken, ownerToken),
        ),
      )
      .returning({ id: schema.idempotencyRecord.id });

    if (!completed) throw new Error("Idempotency claim was lost before completion");
    return { kind: "fresh", result };
  } catch (error) {
    clearInterval(heartbeat);
    try {
      await db()
        .delete(schema.idempotencyRecord)
        .where(
          and(
            eq(schema.idempotencyRecord.id, id),
            eq(schema.idempotencyRecord.status, "pending"),
            eq(schema.idempotencyRecord.ownerToken, ownerToken),
          ),
        );
    } catch {
      // Cleanup failure cannot mask the operation error. The lease still makes
      // the abandoned claim reclaimable rather than permanently poisoning it.
    }
    throw error;
  }
}

export async function checkAndRecordIdempotency<R extends NextResult>(
  path: readonly string[],
  key: string,
  input: unknown,
  run: () => Promise<R>,
): Promise<IdempotencyResolution<R>> {
  const scope = path.join(".");
  const requestHash = hashRequest(input);
  const ownerToken = randomUUID();
  let pollMs = 10;

  while (true) {
    const now = new Date();
    const lockedUntil = new Date(now.getTime() + CLAIM_LEASE_MS);
    const expiresAt = new Date(now.getTime() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
    const [inserted] = await db()
      .insert(schema.idempotencyRecord)
      .values({
        scope,
        idempotencyKey: key,
        requestHash,
        status: "pending",
        ownerToken,
        lockedUntil,
        responseStatus: null,
        responseBody: null,
        expiresAt,
      })
      .onConflictDoNothing()
      .returning({ id: schema.idempotencyRecord.id });

    if (inserted) return runClaimed(inserted.id, ownerToken, run);

    const existing = await db().query.idempotencyRecord.findFirst({
      where: (record, { and, eq }) =>
        and(eq(record.scope, scope), eq(record.idempotencyKey, key)),
    });

    // The winner may have rolled a failed claim back between our insert and
    // read. Retry the atomic insert in that case.
    if (!existing) continue;

    if (existing.status === "completed") {
      if (existing.expiresAt <= now) {
        await db()
          .delete(schema.idempotencyRecord)
          .where(
            and(
              eq(schema.idempotencyRecord.id, existing.id),
              eq(schema.idempotencyRecord.status, "completed"),
              lte(schema.idempotencyRecord.expiresAt, now),
            ),
          );
        continue;
      }
      if (existing.requestHash !== requestHash) conflict();
      return { kind: "replay", output: existing.responseBody };
    }

    if (existing.requestHash !== requestHash) conflict();
    if (!existing.lockedUntil || existing.lockedUntil <= now) {
      const [reclaimed] = await db()
        .update(schema.idempotencyRecord)
        .set({
          ownerToken,
          lockedUntil,
          expiresAt,
        })
        .where(
          and(
            eq(schema.idempotencyRecord.id, existing.id),
            eq(schema.idempotencyRecord.status, "pending"),
            or(
              isNull(schema.idempotencyRecord.lockedUntil),
              lte(schema.idempotencyRecord.lockedUntil, now),
            ),
          ),
        )
        .returning({ id: schema.idempotencyRecord.id });

      if (reclaimed) return runClaimed(reclaimed.id, ownerToken, run);
      continue;
    }

    await sleep(pollMs);
    pollMs = Math.min(pollMs * 2, MAX_POLL_MS);
  }
}
