import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { campaign } from "./campaign.ts";
import { customer } from "./customer.ts";

export type VoucherType = "DISCOUNT" | "GIFT_CARD";

// Numeric discount: AMOUNT (cents off) or PERCENTAGE (basis points 0-10000).
// All other reward kinds (FREE_SHIPPING, etc.) live in customRewards as
// {typeKey, payload} entries — emitted to the integrator on redemption.
export interface VoucherDiscount {
  type: "AMOUNT" | "PERCENTAGE";
  amount?: number; // cents (AMOUNT only)
  percent?: number; // basis points 0-10000 (PERCENTAGE only)
  maxDiscountAmount?: number; // cents cap (PERCENTAGE only, optional for AMOUNT)
  appliesTo?: { productIds?: string[]; collectionIds?: string[] };
}

export interface CustomReward {
  typeKey: string;
  payload: Record<string, unknown>;
}

export const voucher = pgTable(
  "voucher",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    campaignId: uuid("campaign_id").references(() => campaign.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["DISCOUNT", "GIFT_CARD"] }).notNull(),
    discount: jsonb("discount").$type<VoucherDiscount>(),
    customRewards: jsonb("custom_rewards").$type<CustomReward[]>().notNull().default([]),
    giftBalance: integer("gift_balance"),
    redemptionLimit: integer("redemption_limit"),
    perUserRedemptionLimit: integer("per_user_redemption_limit"),
    redemptionCount: integer("redemption_count").notNull().default(0),
    priority: integer("priority").notNull().default(0),
    exclusive: boolean("exclusive").notNull().default(false),
    active: boolean("active").notNull().default(true),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    customerId: uuid("customer_id").references(() => customer.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("voucher_campaign_id_idx").on(t.campaignId),
    index("voucher_customer_id_idx").on(t.customerId),
    index("voucher_active_idx").on(t.active),
    index("voucher_deleted_at_idx").on(t.deletedAt),
    uniqueIndex("voucher_code_active_unique")
      .on(t.code)
      .where(sql`${t.deletedAt} IS NULL`),
  ],
);
