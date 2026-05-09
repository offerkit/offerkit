-- Add external_order_id alongside order_id, preserve existing free-form
-- text values into the new column, then narrow order_id to uuid + FK.
ALTER TABLE "redemption" ADD COLUMN "external_order_id" text;--> statement-breakpoint
UPDATE "redemption" SET "external_order_id" = "order_id" WHERE "order_id" IS NOT NULL;--> statement-breakpoint
-- Wipe order_id values that aren't uuid-shaped before the type narrow.
-- Leaves valid-uuid strings alone so they can be cast in place.
UPDATE "redemption" SET "order_id" = NULL
  WHERE "order_id" IS NOT NULL
    AND "order_id" !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';--> statement-breakpoint
ALTER TABLE "redemption" ALTER COLUMN "order_id" SET DATA TYPE uuid USING "order_id"::uuid;--> statement-breakpoint
ALTER TABLE "redemption" ADD CONSTRAINT "redemption_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "redemption_order_id_idx" ON "redemption" USING btree ("order_id");
