import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { validationRule } from "./validation-rule.ts";

export type CampaignType =
  | "DISCOUNT"
  | "GIFT_VOUCHERS"
  | "LOYALTY_PROGRAM"
  | "REFERRAL_PROGRAM"
  | "PROMOTION";

export type CampaignStatus = "draft" | "active" | "paused" | "ended";

export interface CodeConfig {
  length?: number;
  prefix?: string;
  suffix?: string;
  charset?: "alphanumeric" | "uppercase" | "lowercase" | "numeric";
  excludeConfusable?: boolean;
}

export const campaign = pgTable(
  "campaign",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    description: text("description"),
    type: text("type", {
      enum: ["DISCOUNT", "GIFT_VOUCHERS", "LOYALTY_PROGRAM", "REFERRAL_PROGRAM", "PROMOTION"],
    }).notNull(),
    status: text("status", { enum: ["draft", "active", "paused", "ended"] })
      .notNull()
      .default("draft"),
    currency: text("currency").notNull(),
    timezone: text("timezone").notNull().default("UTC"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    codeConfig: jsonb("code_config").$type<CodeConfig>().notNull().default({}),
    validationRuleId: uuid("validation_rule_id").references(() => validationRule.id, {
      onDelete: "set null",
    }),
    perUserRedemptionLimit: integer("per_user_redemption_limit"),
    autoApply: boolean("auto_apply").notNull().default(false),
    voucherCount: integer("voucher_count").notNull().default(0),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("campaign_type_idx").on(t.type),
    index("campaign_status_idx").on(t.status),
    index("campaign_deleted_at_idx").on(t.deletedAt),
  ],
);
