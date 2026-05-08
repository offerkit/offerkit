import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// JSON Logic rules are stored as opaque jsonb. The shape is enforced by Zod
// in the contract layer; the DB just persists whatever the engine accepts.
export type SegmentRule = Record<string, unknown>;

export const segment = pgTable(
  "segment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    rule: jsonb("rule").$type<SegmentRule>().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("segment_deleted_at_idx").on(t.deletedAt)],
);
