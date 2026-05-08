import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// Admin-defined reward kinds (FREE_SHIPPING, FREE_BUYER_PROTECTION, etc).
// The engine emits {type: key, payload: ...} in redemption responses; the
// integrator's storefront honors them. Schema validation happens at emit
// time against the active payloadSchema revision.
export const rewardType = pgTable(
  "reward_type",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    activeRevisionId: uuid("active_revision_id"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reward_type_deleted_at_idx").on(t.deletedAt)],
);

// Append-only history so admin edits don't break running redemptions.
export const rewardTypeRevision = pgTable(
  "reward_type_revision",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    rewardTypeId: uuid("reward_type_id")
      .notNull()
      .references(() => rewardType.id, { onDelete: "cascade" }),
    payloadSchema: jsonb("payload_schema").$type<Record<string, unknown>>().notNull(),
    checksum: text("checksum").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("reward_type_revision_reward_type_id_idx").on(t.rewardTypeId)],
);
