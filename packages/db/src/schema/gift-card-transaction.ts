import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { redemption } from "./redemption.ts";
import { voucher } from "./voucher.ts";

// Append-only ledger for gift card balance moves.
// Sum of `delta` per voucher should always equal voucher.giftBalance minus
// the original credit (we record the initial credit as the first row).
export const giftCardTransaction = pgTable(
  "gift_card_transaction",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    voucherId: uuid("voucher_id")
      .notNull()
      .references(() => voucher.id, { onDelete: "cascade" }),
    redemptionId: uuid("redemption_id").references(() => redemption.id, {
      onDelete: "set null",
    }),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason", {
      enum: ["CREDIT", "REDEMPTION", "ROLLBACK", "ADJUSTMENT"],
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("gift_card_transaction_voucher_id_idx").on(t.voucherId),
    index("gift_card_transaction_redemption_id_idx").on(t.redemptionId),
  ],
);
