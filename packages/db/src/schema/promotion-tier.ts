import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { campaign } from "./campaign.ts";
import { validationRule } from "./validation-rule.ts";
import type { CustomReward, VoucherDiscount } from "./voucher.ts";

export const promotionTier = pgTable(
  "promotion_tier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaign.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    effect: jsonb("effect").$type<VoucherDiscount>().notNull(),
    customRewards: jsonb("custom_rewards").$type<CustomReward[]>().notNull().default([]),
    validationRuleId: uuid("validation_rule_id").references(() => validationRule.id, {
      onDelete: "set null",
    }),
    active: boolean("active").notNull().default(true),
    priority: integer("priority").notNull().default(0),
    exclusive: boolean("exclusive").notNull().default(false),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("promotion_tier_campaign_id_idx").on(t.campaignId),
    index("promotion_tier_active_idx").on(t.active),
    index("promotion_tier_deleted_at_idx").on(t.deletedAt),
    index("promotion_tier_priority_idx").on(t.priority),
  ],
);
