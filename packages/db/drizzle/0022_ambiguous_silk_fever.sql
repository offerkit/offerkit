CREATE TYPE "public"."idempotency_status" AS ENUM('pending', 'completed');--> statement-breakpoint
ALTER TABLE "idempotency_record" ALTER COLUMN "response_status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_record" ADD COLUMN "status" "idempotency_status" DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "idempotency_record" ADD COLUMN "owner_token" text;--> statement-breakpoint
ALTER TABLE "idempotency_record" ADD COLUMN "locked_until" timestamp with time zone;