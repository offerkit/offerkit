import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const DEFAULT_WORKSPACE_CURRENCY = "USD";

export const workspaceSetting = pgTable("workspace_setting", {
  /** Singleton row, primary key is a fixed sentinel string. */
  id: text("id").primaryKey(),
  name: text("name").notNull().default("offerkit"),
  defaultCurrency: text("default_currency").notNull().default(DEFAULT_WORKSPACE_CURRENCY),
  defaultTimezone: text("default_timezone").notNull().default("UTC"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const WORKSPACE_SETTING_ID = "workspace";
