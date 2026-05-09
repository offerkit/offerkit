import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const workspaceSetting = pgTable("workspace_setting", {
  /** Singleton row, primary key is a fixed sentinel string. */
  id: text("id").primaryKey(),
  name: text("name").notNull().default("open-voucherify"),
  defaultCurrency: text("default_currency").notNull().default("USD"),
  defaultTimezone: text("default_timezone").notNull().default("UTC"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const WORKSPACE_SETTING_ID = "workspace";
