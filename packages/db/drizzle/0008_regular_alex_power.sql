ALTER TABLE "redemption" ADD COLUMN "batch_id" uuid;--> statement-breakpoint
CREATE INDEX "redemption_batch_id_idx" ON "redemption" USING btree ("batch_id");--> statement-breakpoint
CREATE UNIQUE INDEX "redemption_batch_idempotency_idx" ON "redemption" USING btree ("batch_id","idempotency_key") WHERE "redemption"."batch_id" IS NOT NULL AND "redemption"."idempotency_key" IS NOT NULL;