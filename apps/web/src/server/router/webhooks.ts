import { ORPCError, implement } from "@orpc/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { schema } from "@offerkit/db";
import { contract } from "@offerkit/contract/router";
import { mintWebhookSecret } from "@offerkit/core/events";
import { enqueueJob } from "@offerkit/core/jobs";
import type { RequestContext } from "@/server/context";
import { db } from "@/lib/db";
import { requireSession } from "@/server/middleware/auth";
import {
  decodeCursor,
  paginatedSoftDeleteList,
  softDeleteById,
} from "./helpers";

const os = implement(contract).$context<RequestContext>();

type WebhookRow = typeof schema.webhook.$inferSelect;
type WebhookDeliveryRow = typeof schema.webhookDelivery.$inferSelect;
type EventRow = typeof schema.event.$inferSelect;

function toWebhook(row: WebhookRow) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    secretPrefix: row.secretPrefix,
    events: row.events,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEvent(row: EventRow) {
  return {
    id: row.id,
    type: row.type,
    payload: row.payload,
    entityId: row.entityId,
    createdAt: row.createdAt.toISOString(),
  };
}

const list = os.webhooks.list.use(requireSession).handler(async () => {
  const rows = (await db()
    .select()
    .from(schema.webhook)
    .where(isNull(schema.webhook.deletedAt))
    .orderBy(desc(schema.webhook.createdAt))) as WebhookRow[];
  return { data: rows.map(toWebhook) };
});

const get = os.webhooks.get.use(requireSession).handler(async ({ input }) => {
  const row = await db().query.webhook.findFirst({
    where: and(eq(schema.webhook.id, input.id), isNull(schema.webhook.deletedAt)),
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Webhook not found" });
  return toWebhook(row);
});

const create = os.webhooks.create.use(requireSession).handler(async ({ input }) => {
  const minted = mintWebhookSecret();
  const [row] = await db()
    .insert(schema.webhook)
    .values({
      name: input.name,
      url: input.url,
      hashedSecret: minted.hashedSecret,
      secretPrefix: minted.prefix,
      events: input.events,
      active: input.active,
    })
    .returning();
  if (!row) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Insert failed" });
  return { ...toWebhook(row), secret: minted.plaintext };
});

const update = os.webhooks.update.use(requireSession).handler(async ({ input }) => {
  const patch: Partial<typeof schema.webhook.$inferInsert> = { updatedAt: new Date() };
  if (input.patch.name !== undefined) patch.name = input.patch.name;
  if (input.patch.url !== undefined) patch.url = input.patch.url;
  if (input.patch.events !== undefined) patch.events = input.patch.events;
  if (input.patch.active !== undefined) patch.active = input.patch.active;
  const [row] = await db()
    .update(schema.webhook)
    .set(patch)
    .where(and(eq(schema.webhook.id, input.id), isNull(schema.webhook.deletedAt)))
    .returning();
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Webhook not found" });
  return toWebhook(row);
});

const remove = os.webhooks.delete.use(requireSession).handler(async ({ input }) => {
  await softDeleteById(schema.webhook, input.id, "Webhook not found");
  return { ok: true as const };
});

const deliveries = os.webhooks.deliveries.use(requireSession).handler(async ({ input }) => {
  const rows = (await db()
    .select({
      delivery: schema.webhookDelivery,
      eventType: schema.event.type,
    })
    .from(schema.webhookDelivery)
    .innerJoin(schema.event, eq(schema.event.id, schema.webhookDelivery.eventId))
    .where(eq(schema.webhookDelivery.webhookId, input.id))
    .orderBy(desc(schema.webhookDelivery.createdAt))
    .limit(input.limit)) as { delivery: WebhookDeliveryRow; eventType: string }[];
  return {
    data: rows.map(({ delivery, eventType }) => ({
      id: delivery.id,
      webhookId: delivery.webhookId,
      eventId: delivery.eventId,
      eventType,
      status: delivery.status,
      attempts: delivery.attempts,
      responseStatus: delivery.responseStatus,
      responseBody: delivery.responseBody,
      error: delivery.error,
      nextRetryAt: delivery.nextRetryAt?.toISOString() ?? null,
      createdAt: delivery.createdAt.toISOString(),
      updatedAt: delivery.updatedAt.toISOString(),
    })),
  };
});

const replay = os.webhooks.replay.use(requireSession).handler(async ({ input }) => {
  const row = await db().query.webhookDelivery.findFirst({
    where: eq(schema.webhookDelivery.id, input.id),
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Delivery not found" });
  await db()
    .update(schema.webhookDelivery)
    .set({ status: "pending", nextRetryAt: null, error: null, updatedAt: new Date() })
    .where(eq(schema.webhookDelivery.id, row.id));
  await enqueueJob(
    db(),
    "webhook.deliver",
    { deliveryId: row.id },
    { maxAttempts: 1 },
  );
  return { ok: true as const };
});

const eventsList = os.events.list.use(requireSession).handler(({ input }) => {
  const filters = input.type ? [eq(schema.event.type, input.type)] : [];
  const cursor = decodeCursor(input.cursor);
  const where = [...filters];
  if (cursor) {
    where.push(
      sql`(${schema.event.createdAt}, ${schema.event.id}) < (${cursor.createdAt}, ${cursor.id})`,
    );
  }
  // event has no deletedAt; use a small bespoke query rather than the
  // softDelete helper.
  return (async () => {
    const rows = (await db()
      .select()
      .from(schema.event)
      .where(where.length > 0 ? and(...where) : undefined)
      .orderBy(desc(schema.event.createdAt), desc(schema.event.id))
      .limit(input.limit + 1)) as EventRow[];
    const hasMore = rows.length > input.limit;
    const data = rows.slice(0, input.limit);
    const last = data[data.length - 1];
    return {
      data: data.map(toEvent),
      next:
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
              "utf8",
            ).toString("base64url")
          : undefined,
    };
  })();
});

const eventsGet = os.events.get.use(requireSession).handler(async ({ input }) => {
  const row = await db().query.event.findFirst({
    where: eq(schema.event.id, input.id),
  });
  if (!row) throw new ORPCError("NOT_FOUND", { message: "Event not found" });
  return toEvent(row);
});

void paginatedSoftDeleteList;

export const webhooksRouter = { list, get, create, update, delete: remove, deliveries, replay };
export const eventsRouter = { list: eventsList, get: eventsGet };
