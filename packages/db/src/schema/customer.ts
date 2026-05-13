import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

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
    // Caller-supplied stable id from the integrator's system (e.g. their
    // own user uuid). Lets the integrator stay stateless on their side —
    // they call customers.upsert({ externalId }) without having to track
    // the OfferKit-minted uuid. Unique when set (live rows only); null is
    // allowed and many rows can be null.
    externalId: text("external_id"),
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
    uniqueIndex("customer_external_id_unique")
      .on(t.externalId)
      .where(sql`${t.externalId} IS NOT NULL AND ${t.deletedAt} IS NULL`),
  ],
);
