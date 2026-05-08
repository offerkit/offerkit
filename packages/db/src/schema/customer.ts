import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export interface CustomerAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface CustomerSummary {
  totalSpent?: number;
  redemptionCount?: number;
  lastRedeemedAt?: string;
}

export const customer = pgTable(
  "customer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email"),
    name: text("name"),
    phone: text("phone"),
    address: jsonb("address").$type<CustomerAddress>(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    summary: jsonb("summary").$type<CustomerSummary>().notNull().default({}),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("customer_email_idx").on(t.email),
    index("customer_deleted_at_idx").on(t.deletedAt),
    index("customer_created_at_idx").on(t.createdAt),
  ],
);
