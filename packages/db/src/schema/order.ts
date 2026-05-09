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

export type OrderStatus = "CREATED" | "PAID" | "CANCELED" | "FULFILLED";

export interface OrderItem {
  productId?: string;
  sku?: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export const order = pgTable(
  "order",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id"),
    customerId: uuid("customer_id").references(() => customer.id, { onDelete: "set null" }),
    items: jsonb("items").$type<OrderItem[]>().notNull().default([]),
    amount: integer("amount").notNull(),
    discountAmount: integer("discount_amount").notNull().default(0),
    currency: text("currency").notNull(),
    status: text("status", {
      enum: ["CREATED", "PAID", "CANCELED", "FULFILLED"],
    })
      .notNull()
      .default("CREATED"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("order_external_id_idx").on(t.externalId),
    index("order_customer_id_idx").on(t.customerId),
    index("order_created_at_idx").on(t.createdAt),
    index("order_status_idx").on(t.status),
  ],
);
