import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { eq } from "drizzle-orm";
import { schema, type Db } from "@offerkit/db";
import { logger } from "../observability/index.ts";
import { enqueueJob } from "../jobs/index.ts";

const log = logger.child({ component: "events" });

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export interface EmitInput {
  type: string;
  payload: Record<string, unknown>;
  entityId?: string;
}

/**
 * Write an event row inside the caller's transaction and enqueue
 * webhook.deliver jobs for every active subscription that matches the
 * event type. The job table is the same Postgres so this is one tx —
 * if the caller rolls back, the jobs disappear with the event.
 */
export async function emitEvent(
  tx: Tx | Db,
  input: EmitInput,
): Promise<{ eventId: string; deliveriesEnqueued: number }> {
  const [row] = await tx
    .insert(schema.event)
    .values({
      type: input.type,
      payload: input.payload,
      entityId: input.entityId ?? null,
    })
    .returning({ id: schema.event.id });
  if (!row) throw new Error("event insert failed");

  const subs = await tx.query.webhook.findMany({
    where: (t, { and, eq, isNull }) => and(eq(t.active, true), isNull(t.deletedAt)),
  });
  const matching = subs.filter(
    (s) => s.events.includes("*") || s.events.includes(input.type),
  );

  for (const sub of matching) {
    const [delivery] = await tx
      .insert(schema.webhookDelivery)
      .values({ webhookId: sub.id, eventId: row.id, status: "pending" })
      .returning({ id: schema.webhookDelivery.id });
    if (!delivery) throw new Error("webhook delivery insert failed");
    await enqueueJob(
      tx as Db,
      "webhook.deliver",
      { deliveryId: delivery.id },
      { maxAttempts: 7 },
    );
  }

  log.info(
    { eventType: input.type, eventId: row.id, deliveries: matching.length },
    "event emitted",
  );
  return { eventId: row.id, deliveriesEnqueued: matching.length };
}

// ----- secret + signature helpers -----

const SECRET_BYTES = 32;
const ENCRYPTION_VERSION = "v1";
const ENCRYPTION_IV_BYTES = 12;
const ENCRYPTION_KEY_CONTEXT = "offerkit:webhook-secret:v1";

function webhookEncryptionKey(): Buffer {
  const secret = process.env["WEBHOOK_SECRET_ENCRYPTION_KEY"];
  if (!secret || secret.length < 32) {
    throw new Error("WEBHOOK_SECRET_ENCRYPTION_KEY must be at least 32 characters");
  }
  return createHash("sha256")
    .update(ENCRYPTION_KEY_CONTEXT)
    .update("\0")
    .update(secret)
    .digest();
}

function encryptWebhookSecret(plaintext: string): string {
  const iv = randomBytes(ENCRYPTION_IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", webhookEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    ENCRYPTION_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

function decryptWebhookSecret(encrypted: string): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = encrypted.split(":");
  if (
    version !== ENCRYPTION_VERSION ||
    !ivEncoded ||
    !tagEncoded ||
    !ciphertextEncoded
  ) {
    throw new Error("Invalid encrypted webhook secret");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    webhookEncryptionKey(),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export interface MintedSecret {
  /** Plaintext secret. Show once; only its authenticated ciphertext is stored. */
  plaintext: string;
  prefix: string;
  encryptedSecret: string;
}

export function mintWebhookSecret(): MintedSecret {
  const raw = randomBytes(SECRET_BYTES).toString("base64url");
  const plaintext = `whsec_${raw}`;
  return {
    plaintext,
    prefix: plaintext.slice(0, 14),
    encryptedSecret: encryptWebhookSecret(plaintext),
  };
}

export function signPayload(secret: string, body: string, now: number = Date.now()): string {
  const t = Math.floor(now / 1000);
  const sig = createHmac("sha256", secret).update(`${String(t)}.${body}`).digest("hex");
  return `t=${String(t)},v1=${sig}`;
}

export interface VerifyOptions {
  /** Reject signatures whose timestamp is older than this many seconds. */
  toleranceSeconds?: number;
  now?: number;
}

export function verifySignature(
  secret: string,
  rawBody: string,
  signature: string,
  options: VerifyOptions = {},
): boolean {
  const tolerance = options.toleranceSeconds ?? 300;
  const now = options.now ?? Date.now();
  const parts = signature.split(",").reduce<Record<string, string>>((acc, p) => {
    const [k, v] = p.split("=");
    if (k && v) acc[k] = v;
    return acc;
  }, {});
  const t = Number(parts["t"]);
  const v1 = parts["v1"];
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(now / 1000 - t) > tolerance) return false;
  const expected = createHmac("sha256", secret).update(`${String(t)}.${rawBody}`).digest("hex");
  if (expected.length !== v1.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(v1, "hex"));
}

// ----- delivery (job handler) -----

export interface DeliverInput {
  deliveryId: string;
}

const RETRY_BACKOFF_MS = [
  60_000, // 1m
  5 * 60_000, // 5m
  30 * 60_000, // 30m
  2 * 60 * 60_000, // 2h
  12 * 60 * 60_000, // 12h
  24 * 60 * 60_000, // 24h
];

export async function deliverWebhook(db: Db, input: DeliverInput): Promise<void> {
  const delivery = await db.query.webhookDelivery.findFirst({
    where: eq(schema.webhookDelivery.id, input.deliveryId),
  });
  if (!delivery) throw new Error(`delivery not found: ${input.deliveryId}`);
  if (delivery.status === "succeeded" || delivery.status === "dead") return;

  const wh = await db.query.webhook.findFirst({
    where: (t, { and, eq, isNull }) => and(eq(t.id, delivery.webhookId), isNull(t.deletedAt)),
  });
  const ev = await db.query.event.findFirst({
    where: eq(schema.event.id, delivery.eventId),
  });
  if (!wh || !ev || !wh.active) {
    await db
      .update(schema.webhookDelivery)
      .set({ status: "dead", error: "subscription disabled or missing", updatedAt: new Date() })
      .where(eq(schema.webhookDelivery.id, delivery.id));
    return;
  }

  if (!wh.encryptedSecret) {
    await db
      .update(schema.webhookDelivery)
      .set({
        status: "dead",
        error: "webhook signing secret predates encrypted storage; recreate the webhook",
        updatedAt: new Date(),
      })
      .where(eq(schema.webhookDelivery.id, delivery.id));
    return;
  }

  const body = JSON.stringify({
    id: ev.id,
    type: ev.type,
    payload: ev.payload,
    createdAt: ev.createdAt.toISOString(),
  });
  const signature = signPayload(decryptWebhookSecret(wh.encryptedSecret), body);

  const attempt = delivery.attempts + 1;
  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let error: string;
  try {
    const res = await fetch(wh.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-offerkit-signature": signature,
        "x-offerkit-event-id": ev.id,
        "x-offerkit-event-type": ev.type,
      },
      body,
    });
    responseStatus = res.status;
    responseBody = (await res.text()).slice(0, 4_000);
    if (res.status >= 200 && res.status < 300) {
      await db
        .update(schema.webhookDelivery)
        .set({
          status: "succeeded",
          attempts: attempt,
          responseStatus,
          responseBody,
          updatedAt: new Date(),
        })
        .where(eq(schema.webhookDelivery.id, delivery.id));
      return;
    }
    error = `HTTP ${String(res.status)}`;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  const dead = attempt > RETRY_BACKOFF_MS.length;
  const nextDelay = dead ? null : RETRY_BACKOFF_MS[attempt - 1] ?? null;
  const nextRetryAt = nextDelay != null ? new Date(Date.now() + nextDelay) : null;
  await db
    .update(schema.webhookDelivery)
    .set({
      status: dead ? "dead" : "failed",
      attempts: attempt,
      responseStatus,
      responseBody,
      error,
      nextRetryAt,
      updatedAt: new Date(),
    })
    .where(eq(schema.webhookDelivery.id, delivery.id));

  if (!dead && nextDelay != null) {
    await enqueueJob(
      db,
      "webhook.deliver",
      { deliveryId: delivery.id },
      { runAt: new Date(Date.now() + nextDelay), maxAttempts: 1 },
    );
  } else {
    log.warn({ deliveryId: delivery.id, attempts: attempt }, "webhook delivery dead-lettered");
  }
}
