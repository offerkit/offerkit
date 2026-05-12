import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { campaign } from "./campaign.ts";
import { customer } from "./customer.ts";

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

// Snapshot of what was actually issued to a side at conversion time.
// Stored on referralConversion so idempotent replay can return the same
// outcome without re-deriving from voucher/loyalty rows.
export interface ReferralOutcome {
  kind: "discount" | "gift_card" | "loyalty_points" | "custom";
  voucherCode?: string;
  loyaltyTransactionId?: string;
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

// A stable per-customer referral code. Idempotent: one row per
// (program, referrerCustomerId). The customer shares this code with many
// friends; each friend's conversion is tracked as a separate
// referralConversion row.
export const referralCode = pgTable(
  "referral_code",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => referralProgram.id, { onDelete: "cascade" }),
    referrerCustomerId: uuid("referrer_customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("referral_code_program_id_idx").on(t.programId),
    index("referral_code_referrer_customer_id_idx").on(t.referrerCustomerId),
    unique("referral_code_program_referrer_unique").on(t.programId, t.referrerCustomerId),
  ],
);

// One row per actual conversion. A given referralCode can have many
// conversions (one per referee). Idempotency is keyed two ways:
// - (codeId, refereeCustomerId) unique: the same referee can't convert
//   the same code twice.
// - (codeId, conversionEventId) unique when conversionEventId is set:
//   replaying a conversion event (e.g. duplicate Stripe webhook) returns
//   the existing row instead of inserting a new one.
export const referralConversion = pgTable(
  "referral_conversion",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    codeId: uuid("code_id")
      .notNull()
      .references(() => referralCode.id, { onDelete: "cascade" }),
    refereeCustomerId: uuid("referee_customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["converted", "rejected"] })
      .notNull()
      .default("converted"),
    convertedAt: timestamp("converted_at", { withTimezone: true }).notNull().defaultNow(),
    conversionEventId: text("conversion_event_id"),
    // Snapshot of the reward issued to each side. Enables idempotent
    // replay without re-deriving from voucher/loyalty rows.
    referrerOutcome: jsonb("referrer_outcome").$type<ReferralOutcome>().notNull(),
    refereeOutcome: jsonb("referee_outcome").$type<ReferralOutcome>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("referral_conversion_code_id_idx").on(t.codeId),
    index("referral_conversion_referee_customer_id_idx").on(t.refereeCustomerId),
    index("referral_conversion_status_idx").on(t.status),
    unique("referral_conversion_code_referee_unique").on(t.codeId, t.refereeCustomerId),
    // Partial unique index for event-id dedupe. Allows multiple null event
    // ids (each is distinct) but enforces uniqueness when set.
    uniqueIndex("referral_conversion_code_event_unique")
      .on(t.codeId, t.conversionEventId)
      .where(sql`${t.conversionEventId} IS NOT NULL`),
  ],
);
