import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { and, eq, gt } from "drizzle-orm";
import { schema } from "@open-voucherify/db";
import { db } from "@/lib/db";

const IDEMPOTENCY_TTL_HOURS = 24;

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

export async function checkAndRecordIdempotency<R extends NextResult>(
  path: readonly string[],
  key: string,
  input: unknown,
  run: () => Promise<R>,
): Promise<IdempotencyResolution<R>> {
  const scope = path.join(".");
  const requestHash = hashRequest(input);
  const now = new Date();

  const existing = await db().query.idempotencyRecord.findFirst({
    where: and(
      eq(schema.idempotencyRecord.scope, scope),
      eq(schema.idempotencyRecord.idempotencyKey, key),
      gt(schema.idempotencyRecord.expiresAt, now),
    ),
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ORPCError("CONFLICT", {
        message: "Idempotency-Key reused with a different request body",
      });
    }
    return { kind: "replay", output: existing.responseBody };
  }

  const result = await run();

  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
  await db()
    .insert(schema.idempotencyRecord)
    .values({
      scope,
      idempotencyKey: key,
      requestHash,
      responseStatus: 200,
      responseBody: serialize(result.output),
      expiresAt,
    })
    .onConflictDoNothing();

  return { kind: "fresh", result };
}
