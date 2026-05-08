import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export type JsonLogicRule = Record<string, unknown>;

// Reusable validation rules that campaigns and reward earning rules reference.
export const validationRule = pgTable(
  "validation_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    rule: jsonb("rule").$type<JsonLogicRule>().notNull(),
    appliesTo: text("applies_to", {
      enum: ["voucher", "promotion", "earn", "reward"],
    })
      .notNull()
      .default("voucher"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("validation_rule_deleted_at_idx").on(t.deletedAt)],
);
