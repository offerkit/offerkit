CREATE TABLE "gift_card_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"voucher_id" uuid NOT NULL,
	"redemption_id" uuid,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_voucher_id_voucher_id_fk" FOREIGN KEY ("voucher_id") REFERENCES "public"."voucher"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_redemption_id_redemption_id_fk" FOREIGN KEY ("redemption_id") REFERENCES "public"."redemption"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gift_card_transaction_voucher_id_idx" ON "gift_card_transaction" USING btree ("voucher_id");--> statement-breakpoint
CREATE INDEX "gift_card_transaction_redemption_id_idx" ON "gift_card_transaction" USING btree ("redemption_id");