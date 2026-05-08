import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Append-only event log. Domain ops emit rows from inside their own
// transaction; the webhook fan-out reads from here. Indexed by type +
// createdAt so dashboards and webhook delivery can scan recent activity.
export const event = pgTable(
  "event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    /**
     * Optional pointer to the entity the event is about (voucher.id,
     * customer.id, …). Not a foreign key — entities can be soft-deleted
     * later and we want events to outlive them.
     */
    entityId: text("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("event_type_idx").on(t.type),
    index("event_created_at_idx").on(t.createdAt),
    index("event_entity_id_idx").on(t.entityId),
  ],
);
