import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { campaign } from "./campaign.ts";
import { customer } from "./customer.ts";
import { redemption } from "./redemption.ts";

// Mirrors the loyalty reward shape so an integrator can reuse the same
// "honor a kind+payload" code path. kind=discount issues a voucher,
// kind=gift_card issues a gift voucher with creditCents balance,
// kind=loyalty_points credits the customer's loyalty balance,
// kind=custom emits {typeKey, payload} for the integrator to honor.
export interface ReferralReward {
  kind: "discount" | "gift_card" | "loyalty_points" | "custom";
  discount?: {
    type: "AMOUNT" | "PERCENTAGE";
    amount?: number;
    percent?: number;
    maxDiscountAmount?: number;
  };
  creditCents?: number;
  // For loyalty_points; programId is the loyalty program to credit.
  loyaltyProgramId?: string;
  loyaltyPoints?: number;
  // For custom rewards.
  typeKey?: string;
  payload?: Record<string, unknown>;
}

export const referralProgram = pgTable(
  "referral_program",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .unique()
      .references(() => campaign.id, { onDelete: "cascade" }),
    referrerReward: jsonb("referrer_reward").$type<ReferralReward>().notNull(),
    refereeReward: jsonb("referee_reward").$type<ReferralReward>().notNull(),
    // Code length passed to generateReferralCode for the random suffix.
    codeLength: integer("code_length").notNull().default(8),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("referral_program_deleted_at_idx").on(t.deletedAt)],
);

export const referral = pgTable(
  "referral",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => referralProgram.id, { onDelete: "cascade" }),
    referrerCustomerId: uuid("referrer_customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    refereeCustomerId: uuid("referee_customer_id").references(() => customer.id, {
      onDelete: "set null",
    }),
    code: text("code").notNull().unique(),
    status: text("status", { enum: ["issued", "converted", "rejected"] })
      .notNull()
      .default("issued"),
    // Set when conversion succeeds.
    convertedAt: timestamp("converted_at", { withTimezone: true }),
    conversionEventId: text("conversion_event_id"),
    // The redemption rows produced for each side, when applicable.
    referrerRedemptionId: uuid("referrer_redemption_id").references(() => redemption.id, {
      onDelete: "set null",
    }),
    refereeRedemptionId: uuid("referee_redemption_id").references(() => redemption.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("referral_program_id_idx").on(t.programId),
    index("referral_referrer_customer_id_idx").on(t.referrerCustomerId),
    index("referral_status_idx").on(t.status),
    unique("referral_program_referrer_unique").on(t.programId, t.referrerCustomerId),
  ],
);
