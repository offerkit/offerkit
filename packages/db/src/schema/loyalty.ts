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
import { validationRule } from "./validation-rule.ts";

// One loyalty program per campaign (campaign.type === 'LOYALTY_PROGRAM').
// pointsExpiryDays null = points never expire.
export const loyaltyProgram = pgTable(
  "loyalty_program",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    campaignId: uuid("campaign_id")
      .notNull()
      .unique()
      .references(() => campaign.id, { onDelete: "cascade" }),
    pointsExpiryDays: integer("points_expiry_days"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loyalty_program_deleted_at_idx").on(t.deletedAt)],
);

// Tier earnMultiplier is basis points (10000 = 1.0x). Threshold is the
// lifetime points required to enter the tier; lowest tier should be 0.
export const loyaltyTier = pgTable(
  "loyalty_tier",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyProgram.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    threshold: integer("threshold").notNull(),
    earnMultiplier: integer("earn_multiplier").notNull().default(10000),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("loyalty_tier_program_id_idx").on(t.programId)],
);

export interface LoyaltyEarnFormula {
  kind: "fixed" | "per_cents" | "custom";
  // fixed: emit `value` points per matching event
  // per_cents: emit floor(order.amount / divisor) points (e.g. divisor=100 → 1 pt per dollar)
  // custom: caller supplies points explicitly
  value?: number;
  divisor?: number;
}

export const loyaltyEarningRule = pgTable(
  "loyalty_earning_rule",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyProgram.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    event: text("event").notNull(),
    validationRuleId: uuid("validation_rule_id").references(() => validationRule.id, {
      onDelete: "set null",
    }),
    formula: jsonb("formula").$type<LoyaltyEarnFormula>().notNull(),
    active: text("active", { enum: ["yes", "no"] })
      .notNull()
      .default("yes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("loyalty_earning_rule_program_id_idx").on(t.programId),
    index("loyalty_earning_rule_event_idx").on(t.event),
  ],
);

export interface LoyaltyRewardPayload {
  kind: "discount" | "gift_card" | "custom";
  // discount: { type: 'AMOUNT'|'PERCENTAGE', amount?, percent?, maxDiscountAmount? }
  discount?: {
    type: "AMOUNT" | "PERCENTAGE";
    amount?: number;
    percent?: number;
    maxDiscountAmount?: number;
  };
  // gift_card: { creditCents }
  creditCents?: number;
  // custom: { typeKey, payload }
  typeKey?: string;
  payload?: Record<string, unknown>;
}

export const loyaltyReward = pgTable(
  "loyalty_reward",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyProgram.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    cost: integer("cost").notNull(),
    payload: jsonb("payload").$type<LoyaltyRewardPayload>().notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("loyalty_reward_program_id_idx").on(t.programId),
    index("loyalty_reward_deleted_at_idx").on(t.deletedAt),
  ],
);

// balance is the materialized cache; sum of loyalty_transaction.delta
// scoped to non-expired entries is the source of truth and rebuildable.
export const loyaltyMember = pgTable(
  "loyalty_member",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customer.id, { onDelete: "cascade" }),
    programId: uuid("program_id")
      .notNull()
      .references(() => loyaltyProgram.id, { onDelete: "cascade" }),
    balance: integer("balance").notNull().default(0),
    lifetimePoints: integer("lifetime_points").notNull().default(0),
    currentTierId: uuid("current_tier_id").references(() => loyaltyTier.id, {
      onDelete: "set null",
    }),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("loyalty_member_customer_program_unique").on(t.customerId, t.programId),
    index("loyalty_member_program_id_idx").on(t.programId),
  ],
);

export const loyaltyTransaction = pgTable(
  "loyalty_transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => loyaltyMember.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason", {
      enum: ["EARN", "REDEEM", "ADJUSTMENT", "EXPIRY", "ROLLBACK"],
    }).notNull(),
    rewardId: uuid("reward_id").references(() => loyaltyReward.id, { onDelete: "set null" }),
    earningRuleId: uuid("earning_rule_id").references(() => loyaltyEarningRule.id, {
      onDelete: "set null",
    }),
    eventId: text("event_id"),
    note: text("note"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    expiredAt: timestamp("expired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("loyalty_transaction_member_id_idx").on(t.memberId),
    index("loyalty_transaction_expires_at_idx").on(t.expiresAt),
  ],
);
