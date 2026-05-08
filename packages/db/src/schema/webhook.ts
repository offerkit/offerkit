import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { event } from "./event.ts";

export const webhook = pgTable(
  "webhook",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    url: text("url").notNull(),
    /**
     * Hashed shared secret. The plaintext is shown once at creation and
     * stored on the integrator side; we keep only sha256(secret) so
     * compromise of the DB doesn't reveal the signing key.
     */
    hashedSecret: text("hashed_secret").notNull(),
    /** Plaintext prefix for UI display (`whsec_AbCdEf…`). */
    secretPrefix: text("secret_prefix").notNull(),
    /** Subscribed event types; `["*"]` = everything. */
    events: jsonb("events").$type<string[]>().notNull().default(["*"]),
    active: boolean("active").notNull().default(true),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("webhook_deleted_at_idx").on(t.deletedAt)],
);

export type WebhookDeliveryStatus = "pending" | "succeeded" | "failed" | "dead";

export const webhookDelivery = pgTable(
  "webhook_delivery",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    webhookId: uuid("webhook_id")
      .notNull()
      .references(() => webhook.id, { onDelete: "cascade" }),
    eventId: uuid("event_id")
      .notNull()
      .references(() => event.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "succeeded", "failed", "dead"] })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    responseStatus: integer("response_status"),
    responseBody: text("response_body"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("webhook_delivery_webhook_id_idx").on(t.webhookId),
    index("webhook_delivery_status_idx").on(t.status),
    index("webhook_delivery_event_id_idx").on(t.eventId),
  ],
);
