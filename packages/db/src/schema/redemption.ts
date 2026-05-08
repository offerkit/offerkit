import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { customer } from "./customer.ts";
import { voucher } from "./voucher.ts";

export type RedemptionResult = "SUCCESS" | "FAILURE" | "ROLLBACK";

export const redemption = pgTable(
  "redemption",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => voucher.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customer.id, { onDelete: "set null" }),
    orderId: text("order_id"),
    result: text("result", { enum: ["SUCCESS", "FAILURE", "ROLLBACK"] }).notNull(),
    failureReason: text("failure_reason"),
    amount: integer("amount"),
    breakdown: jsonb("breakdown").$type<Record<string, unknown>>(),
    idempotencyKey: text("idempotency_key"),
    parentRedemptionId: uuid("parent_redemption_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("redemption_voucher_id_idx").on(t.voucherId),
    index("redemption_customer_id_idx").on(t.customerId),
    index("redemption_created_at_idx").on(t.createdAt),
    // Partial unique index: idempotencyKey unique per voucher when present.
    uniqueIndex("redemption_voucher_idempotency_idx")
      .on(t.voucherId, t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
  ],
);
