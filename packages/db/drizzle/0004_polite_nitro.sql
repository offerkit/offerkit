CREATE TABLE "loyalty_earning_rule" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"event" text NOT NULL,
	"validation_rule_id" uuid,
	"formula" jsonb NOT NULL,
	"active" text DEFAULT 'yes' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_member" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetime_points" integer DEFAULT 0 NOT NULL,
	"current_tier_id" uuid,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_member_customer_program_unique" UNIQUE("customer_id","program_id")
);
--> statement-breakpoint
CREATE TABLE "loyalty_program" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"points_expiry_days" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_program_campaign_id_unique" UNIQUE("campaign_id")
);
--> statement-breakpoint
CREATE TABLE "loyalty_reward" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"cost" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_tier" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"name" text NOT NULL,
	"threshold" integer NOT NULL,
	"earn_multiplier" integer DEFAULT 10000 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"reason" text NOT NULL,
	"reward_id" uuid,
	"earning_rule_id" uuid,
	"event_id" text,
	"note" text,
	"expires_at" timestamp with time zone,
	"expired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loyalty_earning_rule" ADD CONSTRAINT "loyalty_earning_rule_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_earning_rule" ADD CONSTRAINT "loyalty_earning_rule_validation_rule_id_validation_rule_id_fk" FOREIGN KEY ("validation_rule_id") REFERENCES "public"."validation_rule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_member" ADD CONSTRAINT "loyalty_member_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_member" ADD CONSTRAINT "loyalty_member_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_member" ADD CONSTRAINT "loyalty_member_current_tier_id_loyalty_tier_id_fk" FOREIGN KEY ("current_tier_id") REFERENCES "public"."loyalty_tier"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_program" ADD CONSTRAINT "loyalty_program_campaign_id_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_reward" ADD CONSTRAINT "loyalty_reward_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_tier" ADD CONSTRAINT "loyalty_tier_program_id_loyalty_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."loyalty_program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transaction" ADD CONSTRAINT "loyalty_transaction_member_id_loyalty_member_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."loyalty_member"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transaction" ADD CONSTRAINT "loyalty_transaction_reward_id_loyalty_reward_id_fk" FOREIGN KEY ("reward_id") REFERENCES "public"."loyalty_reward"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transaction" ADD CONSTRAINT "loyalty_transaction_earning_rule_id_loyalty_earning_rule_id_fk" FOREIGN KEY ("earning_rule_id") REFERENCES "public"."loyalty_earning_rule"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "loyalty_earning_rule_program_id_idx" ON "loyalty_earning_rule" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "loyalty_earning_rule_event_idx" ON "loyalty_earning_rule" USING btree ("event");--> statement-breakpoint
CREATE INDEX "loyalty_member_program_id_idx" ON "loyalty_member" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "loyalty_program_deleted_at_idx" ON "loyalty_program" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "loyalty_reward_program_id_idx" ON "loyalty_reward" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "loyalty_reward_deleted_at_idx" ON "loyalty_reward" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX "loyalty_tier_program_id_idx" ON "loyalty_tier" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "loyalty_transaction_member_id_idx" ON "loyalty_transaction" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "loyalty_transaction_expires_at_idx" ON "loyalty_transaction" USING btree ("expires_at");