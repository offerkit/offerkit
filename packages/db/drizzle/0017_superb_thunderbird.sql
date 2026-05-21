CREATE TABLE "promotion_tier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"effect" jsonb NOT NULL,
	"custom_rewards" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"validation_rule_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"exclusive" boolean DEFAULT false NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promotion_tier" ADD CONSTRAINT "promotion_tier_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_tier" ADD CONSTRAINT "promotion_tier_validation_rule_id_validation_rule_id_fk" FOREIGN KEY ("validation_rule_id") REFERENCES "public"."validation_rule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "promotion_tier_campaign_id_idx" ON "promotion_tier" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "promotion_tier_active_idx" ON "promotion_tier" USING btree ("active");--> statement-breakpoint
CREATE INDEX "promotion_tier_deleted_at_idx" ON "promotion_tier" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "promotion_tier_priority_idx" ON "promotion_tier" USING btree ("priority");