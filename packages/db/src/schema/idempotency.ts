import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const idempotencyStatus = pgEnum("idempotency_status", ["pending", "completed"]);

export const idempotencyRecord = pgTable(
  "idempotency_record",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scope: text("scope").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    requestHash: text("request_hash").notNull(),
    status: idempotencyStatus("status").notNull().default("completed"),
    ownerToken: text("owner_token"),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("idempotency_record_scope_key_idx").on(t.scope, t.idempotencyKey)],
);
