CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"name" text,
	"phone" text,
	"address" jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "segment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rule" jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "customer_email_idx" ON "customer" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customer_deleted_at_idx" ON "customer" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "customer_created_at_idx" ON "customer" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "segment_deleted_at_idx" ON "segment" USING btree ("deleted_at");