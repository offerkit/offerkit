import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const apiKey = pgTable("api_key", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  hashedSecret: text("hashed_secret").notNull().unique(),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  rateLimitRps: integer("rate_limit_rps").notNull().default(100),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  disabledAt: timestamp("disabled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
