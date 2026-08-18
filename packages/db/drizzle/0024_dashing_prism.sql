ALTER TABLE "loyalty_program" DROP CONSTRAINT "loyalty_program_campaign_id_unique";--> statement-breakpoint
ALTER TABLE "reward_type" DROP CONSTRAINT "reward_type_key_unique";--> statement-breakpoint
DROP INDEX "order_external_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "loyalty_program_active_campaign_id_unique" ON "loyalty_program" USING btree ("campaign_id") WHERE "loyalty_program"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "reward_type_active_key_unique" ON "reward_type" USING btree ("key") WHERE "reward_type"."deleted_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "order_external_id_idx" ON "order" USING btree ("external_id") WHERE "order"."external_id" IS NOT NULL AND "order"."deleted_at" IS NULL;