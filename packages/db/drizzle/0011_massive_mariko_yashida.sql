CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text,
	"customer_id" uuid,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"amount" integer NOT NULL,
	"discount_amount" integer DEFAULT 0 NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'CREATED' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "order_external_id_idx" ON "order" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "order_customer_id_idx" ON "order" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "order_created_at_idx" ON "order" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "order_status_idx" ON "order" USING btree ("status");